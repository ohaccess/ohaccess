import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { Resend } from 'resend'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { escapeHtml } from '@/lib/escape-html'
import { normalizePhone, usPhoneError } from '@/lib/phone'
import {
  generateCode,
  buildSmsBody,
  isHttpUrl,
  safeUrl,
  isHexColor,
  isEmail,
  buildCrmLeadEmail,
  buildUpcomingOpenHousesHtml,
  agentCopyRecipients,
  isVirtualNumber,
  twilioStatusCallbackUrl,
  SMS_MAX_LENGTH,
  type UpcomingOpenHouse,
} from '@/lib/register-helpers'
import { isExpiredPrepaidAccess, trialLimitFor } from '@/lib/billing-plans'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

// Base URL Twilio posts SMS delivery updates back to. Use the www host so the
// callback isn't lost to the apex→www 308 redirect.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

async function createShortUrl(destinationUrl: string, agentId: string, openHouseId: string, urlType: string): Promise<string | null> {
  let code = generateCode()
  let attempts = 0
  while (attempts < 10) {
    const { data } = await supabase.from('short_urls').select('code').eq('code', code).maybeSingle()
    if (!data) break
    code = generateCode()
    attempts++
  }
  const { error } = await supabase.from('short_urls').insert({
    code,
    destination_url: destinationUrl,
    agent_id: agentId,
    open_house_id: openHouseId,
    url_type: urlType
  })
  if (error) {
    console.error('Short URL creation error:', error)
    return null
  }
  return `https://ohaccess.com/r/${code}`
}

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

    // Two code words: the SMS (text) word is primary; the email word is a
    // fallback. Legacy open houses only have code_word, so reuse it for email.
    const smsCodeWord = openHouse.code_word
    const emailCodeWord = openHouse.code_word_email || openHouse.code_word
    const streetAddress = openHouse.street_address || openHouse.property_address
    const fullAddress = openHouse.property_address
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

    // Generate short URLs (best-effort — if creation fails we just skip the link)
    let listingShortUrl: string | null = null
    let agentShortUrl: string | null = null

    if (isHttpUrl(openHouse.listing_url)) {
      listingShortUrl = await createShortUrl(
        openHouse.listing_url,
        openHouse.agent_id,
        openHouseId,
        'listing'
      )
    }
    if (isHttpUrl(agent?.landing_page_url)) {
      agentShortUrl = await createShortUrl(
        agent.landing_page_url,
        openHouse.agent_id,
        openHouseId,
        'agent'
      )
    }

    // Sponsor's "More information" link — same tracked-short-link pattern as
    // the agent's, so the sponsor card's link clicks are measurable too.
    let sponsorShortUrl: string | null = null
    if (sponsor && isHttpUrl(sponsor.landing_page_url)) {
      sponsorShortUrl = await createShortUrl(
        sponsor.landing_page_url!,
        openHouse.agent_id,
        openHouseId,
        'sponsor'
      )
    }

    // ① VISITOR SMS — keep under SMS_MAX_LENGTH where possible so Twilio
    // bills 1 segment. The "Reply STOP to opt out" line stays in the base
    // message even if it pushes us to 2 segments for very long addresses —
    // TCPA opt-out signaling is more important than the marginal cost.
    const smsBody = buildSmsBody(
      // "at" before the address (not "for") so iPhone data detectors link it
      // to Apple Maps — street-only addresses need that context cue.
      `Codeword at ${streetAddress} is "${smsCodeWord}". Share with host for access. Reply STOP to opt out.`,
      [
        // Bare URL (no "Listing:" label) — the label cost 9 chars, which was
        // enough to push long addresses past the single-segment budget.
        ...(listingShortUrl ? [{ label: '', url: listingShortUrl }] : []),
      ]
    )

    // Skip the code-word text for opted-out numbers (they get the email code
    // instead). Sending would just bounce with Twilio error 21610.
    let visitorSms: Awaited<ReturnType<typeof twilioClient.messages.create>> | null = null
    let smsSendFailed = false
    if (!phoneOptedOut) {
      try {
        visitorSms = await twilioClient.messages.create({
          body: smsBody,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: normalizedPhone || phone,
          // Twilio posts delivery updates (delivered/undelivered/failed) here so we
          // can flag bad numbers on the agent dashboard.
          statusCallback: twilioStatusCallbackUrl(APP_URL),
        })
      } catch (err) {
        // Twilio rejected the number outright (invalid / unreachable). Don't fail
        // the whole sign-in — the visitor still gets their email code — but record
        // it so the agent dashboard flags the bad number right away.
        smsSendFailed = true
        console.error('Visitor SMS send failed:', err)
      }
    }

    // ② VISITOR EMAIL — escape every agent-controlled field before
    // interpolating it into the HTML to prevent injection / tracking-pixel abuse.
    const agentName = escapeHtml(agent?.full_name || 'Your Agent')
    const agentBrokerage = escapeHtml(agent?.brokerage || '')
    const agentDisplayEmail = escapeHtml(agent?.display_email || '')
    const agentPhone = escapeHtml(agent?.phone || '')
    // Dialable form for the tel: link; null if the number can't be normalized.
    const agentPhoneTel = normalizePhone(agent?.phone)
    const headshotUrl = safeUrl(agent?.headshot_url)

    // Team/brokerage members inherit their team's branding (logo + header
    // color) instead of their individual settings, so every agent's emails
    // look consistent. Falls back to the agent's own branding when they
    // aren't on a team or the team hasn't set those fields.
    let brandColor = agent?.primary_color
    let brandLogo = agent?.logo_url
    if (agent?.brokerage_id) {
      const { data: brokerage } = await supabase
        .from('brokerages')
        .select('primary_color, logo_url')
        .eq('id', agent.brokerage_id)
        .maybeSingle()
      if (brokerage?.primary_color) brandColor = brokerage.primary_color
      if (brokerage?.logo_url) brandLogo = brokerage.logo_url
    }
    const headerColor = isHexColor(brandColor) ? brandColor : '#1d1d1f'
    const logoUrl = safeUrl(brandLogo)

    // "Sponsored by" card — rendered directly below the agent's card + logo.
    // Same escaping rules as the agent block: every sponsor-controlled field
    // goes through escapeHtml/safeUrl before touching the HTML.
    let sponsorHtml = ''
    if (sponsor) {
      const sponsorName = escapeHtml(sponsor.full_name || '')
      const sponsorCompany = escapeHtml(sponsor.company || '')
      const sponsorEmail = escapeHtml(sponsor.display_email || '')
      const sponsorPhone = escapeHtml(sponsor.phone || '')
      const sponsorPhoneTel = normalizePhone(sponsor.phone)
      const sponsorLicense = escapeHtml(sponsor.license_number || '')
      const sponsorHeadshot = safeUrl(sponsor.headshot_url)
      const sponsorLogo = safeUrl(sponsor.logo_url)
      sponsorHtml = `
            <div style="background: #fdfaf3; border: 1px solid #ead9ad; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
              <div style="font-size: 10px; font-weight: 700; color: #8a6a1f; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Sponsored by</div>
              <div style="display: flex; align-items: center;">
                ${sponsorHeadshot ? `<img src="${escapeHtml(sponsorHeadshot)}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid #ead9ad;margin-right:16px;" />` : ''}
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: #1d1d1f;">${sponsorName}</div>
                  ${sponsorCompany ? `<div style="font-size: 12px; color: #6e6e73;">${sponsorCompany}</div>` : ''}
                  ${sponsorEmail ? `<div style="font-size: 12px; color: #0071e3;">${sponsorEmail}</div>` : ''}
                  ${sponsorPhone ? `<div style="font-size: 12px;">${sponsorPhoneTel ? `<a href="tel:${escapeHtml(sponsorPhoneTel)}" style="color: #0071e3; text-decoration: none;">${sponsorPhone}</a>` : `<span style="color: #6e6e73;">${sponsorPhone}</span>`}</div>` : ''}
                  ${sponsorLicense ? `<div style="font-size: 11px; color: #6e6e73;">${sponsorLicense}</div>` : ''}
                  ${sponsorShortUrl ? `<div><a href="${escapeHtml(sponsorShortUrl)}" style="font-size: 12px; color: #0071e3;">Sponsor information</a></div>` : ''}
                </div>
              </div>
              ${sponsorLogo ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ead9ad; text-align: center;"><img src="${escapeHtml(sponsorLogo)}" style="max-height:60px;width:70%;object-fit:contain;" /></div>` : ''}
              <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ead9ad; font-size: 10px; color: #8a6a1f; line-height: 1.5; text-align: center;">
                You are not required to use ${sponsorCompany || sponsorName} for any service. You are free to shop around.
              </div>
            </div>`
    }

    // The agent's copy of the visitor's code email: visible CC to their public
    // display email (fallback login), hidden BCC to their login as a backup.
    const agentCopy = agentCopyRecipients(agent?.display_email, agent?.email)

    // "Upcoming Open Houses" section: the next 5 open houses over the next 10
    // days from this agent (plus their team, when they're on one), kept to the
    // same state as the one just visited, soonest first. Scoped to agent+team
    // only — never brokerage-wide — so one agent's email doesn't market a
    // stranger's listing to their lead. Best-effort: a lookup failure just
    // means the email goes out without the section.
    let upcomingHtml = ''
    try {
      let agentIds: string[] = [openHouse.agent_id]
      if (agent?.brokerage_id) {
        const { data: teammates } = await supabase
          .from('profiles')
          .select('id')
          .eq('brokerage_id', agent.brokerage_id)
        if (teammates && teammates.length > 0) {
          agentIds = teammates.map(t => t.id)
          if (!agentIds.includes(openHouse.agent_id)) agentIds.push(openHouse.agent_id)
        }
      }

      const nowIso = new Date().toISOString()
      const horizonIso = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
      let query = supabase
        .from('open_houses')
        .select('id, property_address, city, open_house_date, open_house_hours, listing_price, bedrooms, bathrooms, start_at, end_at')
        .in('agent_id', agentIds)
        .neq('id', openHouseId)
        .gte('start_at', nowIso)
        .lte('start_at', horizonIso)
        .order('start_at', { ascending: true })
        .order('city', { ascending: true })
        .limit(5)
      // Case-insensitive state match ("TX" vs "tx"); wildcard chars stripped
      // since ilike would treat them as patterns. No state on the visited open
      // house (legacy rows) -> skip the filter rather than the whole section.
      const state = (openHouse.state || '').trim().replace(/[%_]/g, '')
      if (state) query = query.ilike('state', state)

      const { data: upcoming } = await query
      upcomingHtml = buildUpcomingOpenHousesHtml((upcoming || []) as UpcomingOpenHouse[], APP_URL)
    } catch (err) {
      console.error('Upcoming open houses lookup failed:', err)
    }

    const visitorEmail = await resend.emails.send({
      from: 'ohACCESS <noreply@mail.ohaccess.com>',
      to: email,
      cc: agentCopy.cc,
      bcc: agentCopy.bcc,
      // Replies go to the host agent (the person a visitor would want to
      // reach), not the send-only noreply subdomain — which has no inbox and
      // hard-bounces any reply.
      replyTo: agent?.display_email || agent?.email || 'support@ohaccess.com',
      subject: `Your ohACCESS codeword: ${emailCodeWord}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 20px;">
          <div style="background: ${headerColor}; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
            <div style="font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">Your codeword is ready</div>
          </div>
          <div style="background: white; border-radius: 0 0 16px 16px; padding: 24px;">
            <div style="background: #f5f5f7; border: 1px dashed #d1d1d6; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 16px;">
              <div style="font-size: 11px; color: #6e6e73; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">Your Email Codeword</div>
              <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #1d1d1f;"><q>${escapeHtml(emailCodeWord)}</q></div>
              <div style="font-size: 12px; color: #6e6e73; margin-top: 8px;">Share this codeword with the host at the door to gain access.</div>
              <div style="font-size: 11px; color: #6e6e73; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e5ea;">📱 We also texted you a separate codeword. If the host asks for your <strong>SMS codeword</strong>, check your phone&apos;s messages.</div>
            </div>
            <div style="background: #f5f5f7; border-radius: 10px; padding: 14px; margin-bottom: 16px; font-size: 13px; color: #6e6e73; line-height: 1.8;">
              <strong style="color: #1d1d1f;">${escapeHtml(fullAddress)}</strong><br/>
              📅 ${escapeHtml(openHouse.open_house_date)}<br/>
              🕒 ${escapeHtml(openHouse.open_house_hours)}<br/>
              🛏 ${escapeHtml(openHouse.bedrooms || '—')} bed · 🛁 ${escapeHtml(openHouse.bathrooms || '—')} bath · 📐 ${escapeHtml(openHouse.square_footage || '—')} sq ft <br/>
              💰 ${escapeHtml(openHouse.listing_price || '—')}<br/>
              ${listingShortUrl ? `📝 <a href="${escapeHtml(listingShortUrl)}" style="color: #0071e3; font-weight: 600; font-size: 13px;">Full listing details </a>` : ''}
            </div>
            <div style="background: #f5f5f7; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
              <div style="display: flex; align-items: center;">
                ${headshotUrl ? `<img src="${escapeHtml(headshotUrl)}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid #d1d1d6;margin-right:20px;" />` : ''}
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: #1d1d1f;">${agentName}</div>
                  <div style="font-size: 12px; color: #6e6e73;">${agentBrokerage}</div>
                  ${agentDisplayEmail ? `<div style="font-size: 12px; color: #0071e3;">${agentDisplayEmail}</div>` : ''}
                  ${agentPhone ? `<div style="font-size: 12px;">${agentPhoneTel ? `<a href="tel:${escapeHtml(agentPhoneTel)}" style="color: #0071e3; text-decoration: none;">${agentPhone}</a>` : `<span style="color: #6e6e73;">${agentPhone}</span>`}</div>` : ''}
                  ${agentShortUrl ? `<div><a href="${escapeHtml(agentShortUrl)}" style="font-size: 12px; color: #0071e3;">Agent information</a></div>` : ''}
                </div>
              </div>
              ${logoUrl ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e5ea; text-align: center;"><img src="${escapeHtml(logoUrl)}" style="max-height:80px;width:80%;object-fit:contain;" /></div>` : ''}
            </div>
            ${sponsorHtml}
            ${upcomingHtml}
            <div style="margin-top: 16px; padding: 12px; background: #f5f5f7; border-radius: 8px; font-size: 11px; color: #6e6e73; text-align: center; line-height: 1.6;">
              By registering you agreed to the ohACCESS <a href="https://ohaccess.com/terms" style="color: #6e6e73;">Terms of Service</a>.<br/>
              You consent to be contacted by the host agent${sponsorConsentName ? ` and today's sponsor, ${escapeHtml(sponsorConsentName)}` : ''}.<br/>
              Reply STOP to any text to opt out · <a href="https://ohaccess.com/privacy" style="color: #6e6e73;">Privacy Policy</a><br/>
              <em style="color: #6e6e73;">Heads up: opting out blocks access codes for all future ohACCESS open houses.</em>
            </div>
          </div>
        </div>
      `
    })

    // Record the provider message ids so the Resend / Twilio status webhooks
    // can match later delivery events (bounce / undelivered) back to this
    // visitor. Best-effort: a bookkeeping failure must not fail registration.
    const { error: deliveryIdErr } = await supabase
      .from('visitors')
      .update({
        email_message_id: visitorEmail.data?.id ?? null,
        sms_message_sid: visitorSms?.sid ?? null,
        // A send-time rejection won't get a delivery callback, so flag it now.
        ...(smsSendFailed ? { sms_status: 'failed', delivery_updated_at: new Date().toISOString() } : {}),
      })
      .eq('id', visitorRow.id)
    if (deliveryIdErr) {
      console.error('Failed to store delivery message ids', deliveryIdErr)
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
        body: `ohACCESS: New visitor at ${streetAddress}. ${firstName} ${lastName}, ${phone}${isVirtualNumber(phoneLineType) ? ' (VoIP/internet number - verify ID)' : ''}, ${email}, Timeline: ${purchasingTimeline}, Time: ${now}${visitorShortUrl ? ` ${visitorShortUrl}` : ''}`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: agent.phone
      })
    }

    // Intentionally do NOT return codeWord — that would defeat the SMS/email
    // verification, since any caller could read it from the response. The
    // feedbackToken is safe to return: it only permits one write of this
    // visitor's own feedback.
    return NextResponse.json({ success: true, feedbackToken })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}
