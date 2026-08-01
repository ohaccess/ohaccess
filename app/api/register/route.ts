import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { Resend } from 'resend'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { normalizePhone, usPhoneError } from '@/lib/phone'
import {
  isEmail,
  buildCrmLeadEmail,
  resolveDisclosureLinks,
  isVirtualNumber,
} from '@/lib/register-helpers'
import { isExpiredPrepaidAccess, trialLimitFor } from '@/lib/billing-plans'
import {
  normalizeCustomQuestions,
  questionsForSurface,
  buildCustomAnswers,
} from '@/lib/custom-questions'
import { normalizeAgreementTemplates, resolveAgreementDocs } from '@/lib/agreements'
import { createShortUrl } from '@/lib/short-urls'
import { sendVisitorCodewordMessages } from '@/lib/codeword-messages'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      purchasingTimeline,
      openHouseId
    } = body

    // Language the visitor registered in (for the dashboard flag). Validate
    // against the known set; anything else falls back to English.
    const visitorLang = ['en', 'es', 'vi', 'zh', 'zh-hant', 'ko', 'hi', 'fr', 'de', 'it', 'el', 'pl', 'ru', 'pt', 'tl', 'pa'].includes(body.lang) ? body.lang : 'en'

    if (!firstName || !lastName || !email || !phone || !openHouseId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Reject structurally-impossible phone numbers (bad area code, service
    // codes, fictional 555 range, etc.) — the form blocks these client-side,
    // but enforce it here too so a crafted request can't slip a junk number in.
    const phoneError = usPhoneError(phone)
    if (phoneError) {
      return NextResponse.json({ error: phoneError }, { status: 400 })
    }

    const ip = getClientIp(request)

    // Rate limits — per phone, per open house, per IP. Generous enough that a
    // buyer touring many open houses in one afternoon never hits them; tight
    // enough to stop SMS-bombing a victim's number or running up send costs.
    // Key on the normalized number so "(415) 867-5309" and "4158675309"
    // share one bucket.
    const normalizedPhone = normalizePhone(phone)
    const phoneLimit = await checkRateLimit(`phone:${normalizedPhone || phone}`, 'register', 8, 3600)
    if (!phoneLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many registrations for this phone number. Please try again later.' },
        { status: 429 }
      )
    }

    const ohLimit = await checkRateLimit(`oh:${openHouseId}`, 'register', 60, 3600)
    if (!ohLimit.allowed) {
      return NextResponse.json(
        { error: 'This open house has reached its registration limit for the hour. Please try again later.' },
        { status: 429 }
      )
    }

    const ipLimit = await checkRateLimit(`ip:${ip}`, 'register', 60, 3600)
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Look up open house + agent profile
    const { data: openHouse, error: ohError } = await supabase
      .from('open_houses')
      .select('*, profiles(*)')
      .eq('id', openHouseId)
      .single()

    if (ohError || !openHouse) {
      return NextResponse.json({ error: 'Open house not found' }, { status: 404 })
    }

    const agent = openHouse.profiles

    // Active sponsor (3rd-party provider, e.g. a mortgage lender) — the agent
    // accepted this link explicitly. The sponsor's card renders below the
    // agent's in the visitor email, and the sign-in form named them in the
    // consent language, so the visitor row records who was disclosed.
    let sponsor: {
      id: string
      full_name: string | null
      company: string | null
      display_email: string | null
      phone: string | null
      license_number: string | null
      headshot_url: string | null
      logo_url: string | null
      landing_page_url: string | null
    } | null = null
    // Does a PAYING sponsor cover this agent? (Team-equivalent billing —
    // an active sponsor's agents get Pro-level access, like team members.)
    let sponsorCovered = false
    if (agent?.sponsor_id) {
      const { data: sponsorRow } = await supabase
        .from('sponsors')
        .select('id, full_name, company, display_email, phone, license_number, headshot_url, logo_url, landing_page_url, billing_status')
        .eq('id', agent.sponsor_id)
        .maybeSingle()
      sponsorCovered = sponsorRow?.billing_status === 'active'
      // A sponsor with no name never showed on the sign-in form — treat as none.
      if (sponsorRow?.full_name) sponsor = sponsorRow
    }
    const sponsorConsentName = sponsor
      ? (sponsor.company ? `${sponsor.full_name} (${sponsor.company})` : sponsor.full_name)
      : null

    // Team/brokerage row, fetched ONCE here because two later steps need it:
    // the disclosure links resolved just below (before the visitor insert) and
    // the email branding further down. Null for solo agents.
    let brokerageRow: {
      primary_color: string | null
      logo_url: string | null
      disclosure_links: unknown
    } | null = null
    if (agent?.brokerage_id) {
      const { data } = await supabase
        .from('brokerages')
        .select('primary_color, logo_url, disclosure_links')
        .eq('id', agent.brokerage_id)
        .maybeSingle()
      brokerageRow = data
    }

    // Disclosure/notice links the host agent (or their brokerage) supplies —
    // an IABS, a Consumer Information Statement, whatever their state or broker
    // requires. We deliver and record them; we never pick the form or host it.
    // Resolved BEFORE the visitor insert so the exact list can be snapshotted
    // onto the row: a later edit in Settings must never be able to rewrite what
    // a past visitor was told they received (same reasoning as sponsor_name).
    const disclosureLinks = resolveDisclosureLinks(
      agent?.disclosure_links,
      brokerageRow?.disclosure_links
    )

    // The agent's own extra questions. The sign-in answer arrives with this
    // request; the success-screen questions are returned below and answered
    // later via /api/feedback. Answers snapshot the prompt they were asked
    // under, so editing a question in Settings can't relabel old rows.
    const customQuestions = normalizeCustomQuestions(agent?.custom_questions)
    const signinAnswers = buildCustomAnswers(
      questionsForSurface(customQuestions, 'signin'),
      body.customAnswers
    )
    const successQuestions = questionsForSurface(customQuestions, 'success')

    const streetAddress = openHouse.street_address || openHouse.property_address
    const now = new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'short',
      timeStyle: 'short'
    })

    const agentTier = agent?.tier || 'free'
    // A LEGACY 2-year prepay or an admin comp (both: paid tier, no Stripe
    // subscription) still reads tier=paid after the access date passes. Treat
    // expired prepaid access as free here too (the dashboard already does) so
    // lapsed agents are capped server-side and don't get the paid product for
    // free. Real Stripe subscriptions auto-renew and never trip this.
    const prepaidExpired = isExpiredPrepaidAccess(agent)
    // An agent covered by a paying sponsor gets Pro-level access (no trial
    // cap), same as a member of a paying team.
    const isPro =
      (['pro', 'team', 'brokerage'].includes(agentTier) && !prepaidExpired) || sponsorCovered

    // Trial cap check — BEFORE creating the visitor row, so over-quota
    // requests can't pollute the agent's visitor log. The cap is 25 plus any
    // admin-gifted bonus_visitors (referral thank-yous).
    if (!isPro) {
      const { count } = await supabase
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', openHouse.agent_id)

      if ((count ?? 0) >= trialLimitFor(agent)) {
        return NextResponse.json({
          error: 'This agent has reached their free trial limit. Please ask them to upgrade to Pro at ohaccess.com'
        }, { status: 403 })
      }
    }

    // Has this number opted out of SMS (replied STOP) on any prior open house,
    // for any agent? If so we suppress the code-word text (Twilio would reject
    // it with error 21610 anyway) and flag the visitor. Email still goes out.
    let phoneOptedOut = false
    if (normalizedPhone) {
      const { data: optOut } = await supabase
        .from('sms_opt_outs')
        .select('phone')
        .eq('phone', normalizedPhone)
        .maybeSingle()
      phoneOptedOut = !!optOut
    }

    // Carrier + line type via Twilio Lookup (~$0.008/call). Line type is the
    // burner-number signal: "nonFixedVoip" means a TextNow/Google Voice-style
    // app number rather than a real mobile line. Best-effort with a hard 3s
    // cap — a slow or failed lookup must never block the sign-in.
    let phoneCarrier: string | null = null
    let phoneLineType: string | null = null
    if (normalizedPhone) {
      try {
        const lookup = await Promise.race([
          twilioClient.lookups.v2
            .phoneNumbers(normalizedPhone)
            .fetch({ fields: 'line_type_intelligence' }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('lookup timeout')), 3000)
          ),
        ])
        phoneCarrier = lookup.lineTypeIntelligence?.carrierName ?? null
        phoneLineType = lookup.lineTypeIntelligence?.type ?? null
      } catch (err) {
        console.error('Twilio Lookup failed:', err)
      }
    }

    // One-time handle returned to the visitor's browser so it can submit the
    // post-visit feedback (rating + price) for exactly this visitor, once,
    // without authenticating. Unguessable; write-once enforced in /api/feedback.
    const feedbackToken = randomUUID()

    // Save visitor
    const { data: visitorRow, error: visitorError } = await supabase
      .from('visitors')
      .insert({
        open_house_id: openHouseId,
        agent_id: openHouse.agent_id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        purchasing_timeline: purchasingTimeline,
        lang: visitorLang,
        sms_opted_out: phoneOptedOut,
        source: 'ohaccess',
        feedback_token: feedbackToken,
        // Security metadata (Privacy Policy §2): request origin + phone
        // intelligence, kept for fraud prevention and lawful requests.
        ip_address: ip,
        user_agent: request.headers.get('user-agent'),
        phone_carrier: phoneCarrier,
        phone_line_type: phoneLineType,
        // Consent audit: which sponsor was disclosed on the sign-in form.
        // sponsor_name is a snapshot so the record survives later edits.
        sponsor_id: sponsor?.id ?? null,
        sponsor_name: sponsorConsentName,
        // Snapshot of the disclosure links handed to this visitor, for the
        // same reason: the record must reflect what was actually sent.
        disclosures_sent: disclosureLinks.length > 0 ? disclosureLinks : null,
        custom_answers: signinAnswers.length > 0 ? signinAnswers : null,
      })
      .select('id')
      .single()

    if (visitorError || !visitorRow) {
      return NextResponse.json({ error: 'Failed to save visitor' }, { status: 500 })
    }

    // CRM push via Zapier — best-effort. Only call verified Zapier "Catch Hook"
    // URLs (https://hooks.zapier.com/) to avoid SSRF, and never let a slow or
    // dead webhook delay/break the visitor's registration.
    const zapHook = agent?.zapier_webhook_url
    if (typeof zapHook === 'string' && zapHook.startsWith('https://hooks.zapier.com/')) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 3000)
        await fetch(zapHook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email,
            phone,
            purchasing_timeline: purchasingTimeline,
            registered_at: new Date().toISOString(),
            property_address: openHouse.property_address,
            agent_name: agent?.full_name || '',
            visitor_url: `https://ohaccess.com/visitor/${visitorRow.id}`,
          }),
        })
        clearTimeout(timer)
      } catch { /* best effort — ignore webhook failures */ }
    }

    // CRM push via email-parse — best-effort. Most real estate CRMs (Follow Up
    // Boss, BoldTrail/kvCORE, Lofty, Sierra, Real Geeks, …) issue each user a
    // unique lead-intake address and auto-file any lead-formatted email sent to
    // it. We email a labeled lead notification (+ Lead Metadata Spec meta tags)
    // there so the signup lands in the agent's CRM with no per-CRM API. Reply-To
    // is the visitor so the agent can reply straight to the lead. A failed or
    // slow send must never delay/break registration.
    const sendLeadEmail = (to: string) =>
      resend.emails.send({
        from: 'ohACCESS Leads <noreply@mail.ohaccess.com>',
        to: to.trim(),
        replyTo: isEmail(email) ? email : 'support@ohaccess.com',
        subject: `New Lead from ohACCESS — ${firstName} ${lastName}`,
        html: buildCrmLeadEmail({
          firstName,
          lastName,
          email,
          phone,
          purchasingTimeline,
          propertyAddress: openHouse.property_address || '',
          agentName: agent?.full_name || '',
          registeredAt: now,
          visitorUrl: `https://ohaccess.com/visitor/${visitorRow.id}`,
          customAnswers: signinAnswers,
        }),
      })

    const crmLeadEmail = agent?.crm_lead_email
    if (isEmail(crmLeadEmail)) {
      try { await sendLeadEmail(crmLeadEmail) } catch (err) { console.error('CRM lead-email send failed:', err) }
    }

    // Also forward to the team/brokerage CRM when the member's brokerage has
    // opted in — the team lead then gets every member's open-house lead in one
    // place, on top of the agent's own CRM. Skip if it resolves to the same
    // address the agent already used (avoids a duplicate lead).
    if (agent?.brokerage_id) {
      const { data: brokerage } = await supabase
        .from('brokerages')
        .select('crm_lead_email, crm_forward_member_leads')
        .eq('id', agent.brokerage_id)
        .maybeSingle()
      const teamCrmEmail = brokerage?.crm_lead_email
      if (
        brokerage?.crm_forward_member_leads &&
        isEmail(teamCrmEmail) &&
        teamCrmEmail.trim().toLowerCase() !== (crmLeadEmail || '').trim().toLowerCase()
      ) {
        try { await sendLeadEmail(teamCrmEmail) } catch (err) { console.error('Team CRM lead-email forward failed:', err) }
      }
    }

    // Touring agreement step (migration 043): when this open house requires a
    // signed agreement, tell the browser which documents to show. Only id,
    // label, and page count are exposed — the visitor reads the PDFs through
    // the tokenized /api/agreement/doc route and signs via /api/agreement/sign,
    // both keyed on the same feedbackToken. Revealed only here (not on the
    // public open-house GET) so the documents follow an actual sign-in, and
    // resolved fail-open: stale template ids mean the step simply doesn't
    // appear (lib/agreements doctrine). Resolved BEFORE the sends because an
    // agreement requirement gates the codeword messages below.
    const agreementDocs = openHouse.require_agreement
      ? resolveAgreementDocs(
          normalizeAgreementTemplates(agent?.agreement_templates),
          openHouse.agreement_template_ids
        ).map(d => ({ id: d.id, label: d.label, pages: d.pages }))
      : []
    const agreementRequired = agreementDocs.length > 0

    // ① + ② VISITOR SMS + EMAIL — built and sent by lib/codeword-messages
    // (shared with /api/agreement/sign). When the open house requires a signed
    // agreement, BOTH messages are held back here: the codeword is door
    // access, so nothing carrying it may land before the visitor signs.
    // /api/agreement/sign releases them after the ceremony — it detects the
    // pending sends via the null sms_message_sid / sms_status /
    // email_message_id left on the visitor row.
    if (!agreementRequired) {
      await sendVisitorCodewordMessages({
        visitorId: visitorRow.id,
        email,
        phone,
        phoneOptedOut,
        openHouse,
        agent,
        channels: { sms: true, email: true },
        sponsor,
        brokerageRow,
        disclosureLinks,
      })
    }

    // ③ AGENT SMS ALERT — sent to every agent (paid or within their trial
    // cap). The trial limit is enforced above, so reaching here means the
    // visitor row was allowed; the agent should always be notified.
    // Include a tap-through link to the visitor page where the agent can
    // verify and add notes (best-effort short link).
    if (agent?.phone) {
      let visitorShortUrl: string | null = null
      try {
        visitorShortUrl = await createShortUrl(
          `https://ohaccess.com/visitor/${visitorRow.id}`,
          openHouse.agent_id,
          openHouseId,
          'visitor'
        )
      } catch { /* skip link on failure */ }

      await twilioClient.messages.create({
        // Kept lean so long names/emails still fit one segment: short prefix
        // and a bare verify/notes link (no label).
        // VoIP flag (plain text, not emoji — emoji forces UCS-2 encoding and
        // triples SMS cost). nonFixedVoip = TextNow/Google Voice-style app
        // number, worth extra scrutiny at the door.
        body: `ohACCESS: New visitor at ${streetAddress}. ${firstName} ${lastName}, ${phone}${isVirtualNumber(phoneLineType) ? ' (FYI - VoIP/internet number)' : ''}, ${email}, Timeline: ${purchasingTimeline}, Time: ${now}${visitorShortUrl ? ` ${visitorShortUrl}` : ''}`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: agent.phone
      })
    }

    // Intentionally do NOT return codeWord — that would defeat the SMS/email
    // verification, since any caller could read it from the response. The
    // feedbackToken is safe to return: it only permits one write of this
    // visitor's own feedback.
    // disclosures are echoed back so the success screen can show the same links
    // the email carries — for the visitor who never opens the email.
    return NextResponse.json({
      success: true,
      feedbackToken,
      disclosures: disclosureLinks,
      customQuestions: successQuestions,
      agreement: agreementDocs.length > 0 ? { docs: agreementDocs } : null,
    })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}
