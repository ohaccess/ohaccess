import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import twilio from 'twilio'
import { Resend } from 'resend'
import { escapeHtml } from '@/lib/escape-html'
import { normalizePhone, phoneCountry } from '@/lib/phone'
import { createShortUrl } from '@/lib/short-urls'
import {
  preferredCodewordChannel,
  isWhatsAppFallbackError,
  whatsAppConfigured,
  whatsAppTemplateKind,
  whatsAppAddress,
  type CodewordChannel,
} from '@/lib/messaging-channel'
import { codewordLinkPath } from '@/lib/codeword-link'
import {
  buildSmsBody,
  isHttpUrl,
  safeUrl,
  isHexColor,
  twilioStatusCallbackUrl,
  twilioSender,
  agentCopyRecipients,
  buildDisclosuresHtml,
  resolveDisclosureLinks,
  buildUpcomingOpenHousesHtml,
  type DisclosureLink,
  type UpcomingOpenHouse,
} from '@/lib/register-helpers'

// The visitor's two codeword messages — the SMS and the branded email — built
// and sent from ONE place so they cannot drift apart. Two callers:
//
//   /api/register        — open houses WITHOUT a required agreement: both
//                          messages go out immediately at sign-in.
//   /api/agreement/sign  — agreement-gated open houses: the register route
//                          sends NEITHER message (the codeword is door access,
//                          so it must not land before the visitor signs); the
//                          sign route releases them after the ceremony.
//
// Best-effort throughout: a failed send is logged and flagged on the visitor
// row, but never thrown — neither a sign-in nor a signature ceremony may fail
// because a message didn't go out.

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

// Base URL Twilio posts SMS delivery updates back to. Use the www host so the
// callback isn't lost to the apex→www 308 redirect.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

export type CodewordSponsor = {
  id: string
  full_name: string | null
  company: string | null
  display_email: string | null
  phone: string | null
  license_number: string | null
  headshot_url: string | null
  logo_url: string | null
  landing_page_url: string | null
}

export type CodewordBrokerage = {
  primary_color: string | null
  logo_url: string | null
  disclosure_links: unknown
}

export async function sendVisitorCodewordMessages(params: {
  visitorId: string
  email: string
  phone: string | null
  phoneOptedOut: boolean
  openHouse: {
    id: string
    agent_id: string
    code_word: string | null
    code_word_email: string | null
    street_address: string | null
    zip_code: string | null
    property_address: string | null
    listing_url: string | null
    open_house_date: string | null
    open_house_hours: string | null
    bedrooms: string | null
    bathrooms: string | null
    square_footage: string | null
    listing_price: string | null
    state: string | null
  }
  agent: {
    full_name?: string | null
    brokerage?: string | null
    display_email?: string | null
    email?: string | null
    headshot_url?: string | null
    primary_color?: string | null
    logo_url?: string | null
    landing_page_url?: string | null
    sponsor_id?: string | null
    brokerage_id?: string | null
    disclosure_links?: unknown
  } | null
  // Which messages to (attempt to) send. The sign route uses these to release
  // only what is still pending, so a legacy visitor (texted/emailed at
  // register time, before agreement gating existed) is never messaged twice.
  channels: { sms: boolean; email: boolean }
  // The register route passes rows it already fetched; when omitted
  // (undefined) they are looked up here. null means "none exists".
  sponsor?: CodewordSponsor | null
  brokerageRow?: CodewordBrokerage | null
  disclosureLinks?: DisclosureLink[]
}): Promise<void> {
  const { visitorId, email, phone, phoneOptedOut, openHouse, agent, channels } = params
  if (!channels.sms && !channels.email) return

  // Active sponsor for the "Sponsored by" email card. A sponsor with no name
  // never showed on the sign-in form — treat as none (register-route doctrine).
  let sponsor = params.sponsor
  if (sponsor === undefined) {
    sponsor = null
    if (agent?.sponsor_id) {
      const { data } = await supabase
        .from('sponsors')
        .select('id, full_name, company, display_email, phone, license_number, headshot_url, logo_url, landing_page_url')
        .eq('id', agent.sponsor_id)
        .maybeSingle()
      if (data?.full_name) sponsor = data
    }
  }
  const sponsorConsentName = sponsor
    ? (sponsor.company ? `${sponsor.full_name} (${sponsor.company})` : sponsor.full_name)
    : null

  // Team/brokerage branding + disclosure links (brokerage overrides agent).
  let brokerageRow = params.brokerageRow
  if (brokerageRow === undefined) {
    brokerageRow = null
    if (agent?.brokerage_id) {
      const { data } = await supabase
        .from('brokerages')
        .select('primary_color, logo_url, disclosure_links')
        .eq('id', agent.brokerage_id)
        .maybeSingle()
      brokerageRow = data ?? null
    }
  }
  const disclosureLinks =
    params.disclosureLinks ??
    resolveDisclosureLinks(agent?.disclosure_links, brokerageRow?.disclosure_links)

  // Two code words: the SMS (text) word is primary; the email word is a
  // fallback. Legacy open houses only have code_word, so reuse it for email.
  const smsCodeWord = openHouse.code_word
  const emailCodeWord = openHouse.code_word_email || openHouse.code_word
  const streetAddress = openHouse.street_address || openHouse.property_address
  const fullAddress = openHouse.property_address
  // SMS address = street + zip: a street-only address gives iPhone's Maps
  // auto-link nothing to resolve the town with, and city/state costs 10-25+
  // chars where the zip pins the location for a flat 7. property_address (the
  // fallback when street_address is missing) already ends with the zip.
  const smsAddress =
    openHouse.street_address && openHouse.zip_code
      ? `${openHouse.street_address}, ${openHouse.zip_code}`
      : streetAddress

  // Tracked short links (best-effort — a failure just omits the link). The
  // agent/sponsor links only appear in the email, so skip them on SMS-only
  // sends.
  let listingShortUrl: string | null = null
  let agentShortUrl: string | null = null
  let sponsorShortUrl: string | null = null

  if (isHttpUrl(openHouse.listing_url)) {
    listingShortUrl = await createShortUrl(
      openHouse.listing_url,
      openHouse.agent_id,
      openHouse.id,
      'listing'
    )
  }
  if (channels.email && isHttpUrl(agent?.landing_page_url)) {
    agentShortUrl = await createShortUrl(
      agent!.landing_page_url!,
      openHouse.agent_id,
      openHouse.id,
      'agent'
    )
  }
  if (channels.email && sponsor && isHttpUrl(sponsor.landing_page_url)) {
    sponsorShortUrl = await createShortUrl(
      sponsor.landing_page_url!,
      openHouse.agent_id,
      openHouse.id,
      'sponsor'
    )
  }

  // ① VISITOR SMS (or WhatsApp) — keep under SMS_MAX_LENGTH where possible
  // so Twilio bills 1 segment. The "Reply STOP to opt out" line stays in the
  // base message even if it pushes us to 2 segments for very long addresses
  // — TCPA opt-out signaling is more important than the marginal cost.
  //
  // Skipped for opted-out numbers (they get the email code instead).
  // Sending would just bounce with Twilio error 21610.
  //
  // Channel (lib/messaging-channel.ts): numbers in countries our SMS routes
  // don't serve go out over WhatsApp instead, as an approved template
  // (business-initiated WhatsApp messages must be templates); anyone else's
  // SMS that Twilio rejects with a routing error ("can't reach that region
  // from here") is retried over WhatsApp before we give up. WhatsApp is only
  // ever tried when the sender + template are configured — otherwise this
  // is exactly the SMS-only behaviour it always was.
  let visitorSms: Awaited<ReturnType<typeof twilioClient.messages.create>> | null = null
  let smsSendFailed = false
  let channelUsed: CodewordChannel | null = null
  if (channels.sms && phone && !phoneOptedOut) {
    const to = normalizePhone(phone) || phone
    const statusCallback = twilioStatusCallbackUrl(APP_URL)
    const smsBody = buildSmsBody(
      // "at" before the address (not "for") so iPhone data detectors link it
      // to Apple Maps — street-only addresses need that context cue.
      `Codeword at ${smsAddress} is "${smsCodeWord}". Share with host for access. Reply STOP to opt out.`,
      [
        // Bare URL (no "Listing:" label) — the label cost 9 chars, which was
        // enough to push long addresses past the single-segment budget.
        ...(listingShortUrl ? [{ label: '', url: listingShortUrl }] : []),
      ]
    )
    const sendSms = () =>
      twilioClient.messages.create({
        body: smsBody,
        ...twilioSender(),
        to,
        // Twilio posts delivery updates (delivered/undelivered/failed) here so we
        // can flag bad numbers on the agent dashboard.
        statusCallback,
      })
    // What the approved template's variables carry depends on its kind (see
    // whatsAppTemplateKind): the default "link" template says "tap to view
    // your check-in details" and the page behind the link shows the codeword
    // — Meta rejects Utility templates that put the word in the message
    // itself. The link is minted here, once per WhatsApp send, as a tracked
    // ohaccess.com/r/ short code wrapping the HMAC-signed page URL (never
    // returned to the browser — that would leak the word to a fake number).
    // No listing link in any variant: template bodies are fixed at approval.
    const whatsAppVariables = async (): Promise<Record<string, string>> => {
      const kind = whatsAppTemplateKind()
      const word = smsCodeWord ?? ''
      const address = smsAddress ?? ''
      if (kind === 'auth') return { 1: word }
      if (kind === 'word') return { 1: address, 2: word }
      const full = `${APP_URL}${codewordLinkPath(visitorId)}`
      const short = await createShortUrl(full, openHouse.agent_id, openHouse.id, 'codeword_link')
      return { 1: address, 2: short || full }
    }
    const sendWhatsApp = async () =>
      twilioClient.messages.create({
        from: whatsAppAddress(process.env.TWILIO_WHATSAPP_FROM!),
        to: whatsAppAddress(to),
        contentSid: process.env.TWILIO_WHATSAPP_CODEWORD_CONTENT_SID!,
        contentVariables: JSON.stringify(await whatsAppVariables()),
        statusCallback,
      })

    const preferred = preferredCodewordChannel(phoneCountry(phone))
    try {
      if (preferred === 'whatsapp') {
        // WhatsApp-first country. If WhatsApp itself fails (template still
        // under Meta review, sender offline, a Meta-side hiccup), fall back
        // to SMS rather than give up — it's the visitor's codeword, and in
        // several of these countries (Brazil, Argentina, Colombia) SMS does
        // get through. The SMS attempt's own failure is what gets recorded.
        try {
          visitorSms = await sendWhatsApp()
          channelUsed = 'whatsapp'
        } catch (err) {
          console.warn('Visitor WhatsApp send failed, falling back to SMS:', (err as { code?: unknown })?.code)
          visitorSms = await sendSms()
          channelUsed = 'sms'
        }
      } else {
        try {
          visitorSms = await sendSms()
          channelUsed = 'sms'
        } catch (err) {
          if (whatsAppConfigured() && isWhatsAppFallbackError(err)) {
            console.warn('Visitor SMS unroutable, retrying over WhatsApp:', (err as { code?: unknown })?.code)
            visitorSms = await sendWhatsApp()
            channelUsed = 'whatsapp'
          } else {
            throw err
          }
        }
      }
    } catch (err) {
      // Twilio rejected the number outright (invalid / unreachable). Don't fail
      // the caller — the visitor still gets their email code — but record it so
      // the agent dashboard flags the bad number right away.
      smsSendFailed = true
      channelUsed = preferred
      console.error('Visitor codeword message send failed:', err)
    }
  }

  // ② VISITOR EMAIL — escape every agent-controlled field before
  // interpolating it into the HTML to prevent injection / tracking-pixel abuse.
  let emailMessageId: string | null = null
  if (channels.email) {
    const agentName = escapeHtml(agent?.full_name || 'Your Agent')
    const agentBrokerage = escapeHtml(agent?.brokerage || '')
    const agentDisplayEmail = escapeHtml(agent?.display_email || '')
    const agentPhone = escapeHtml((agent as { phone?: string | null } | null)?.phone || '')
    // Dialable form for the tel: link; null if the number can't be normalized.
    const agentPhoneTel = normalizePhone((agent as { phone?: string | null } | null)?.phone)
    const headshotUrl = safeUrl(agent?.headshot_url)

    // Team/brokerage members inherit their team's branding (logo + header
    // color) instead of their individual settings, so every agent's emails
    // look consistent. Falls back to the agent's own branding when they
    // aren't on a team or the team hasn't set those fields.
    let brandColor = agent?.primary_color
    let brandLogo = agent?.logo_url
    if (brokerageRow?.primary_color) brandColor = brokerageRow.primary_color
    if (brokerageRow?.logo_url) brandLogo = brokerageRow.logo_url
    const headerColor = isHexColor(brandColor) ? brandColor! : '#1d1d1f'
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
        .neq('id', openHouse.id)
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

    try {
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
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 8px;">
          <div style="background: ${headerColor}; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
            <div style="font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">Your codeword is ready</div>
          </div>
          <div style="background: white; border-radius: 0 0 16px 16px; padding: 14px;">
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
            ${buildDisclosuresHtml(disclosureLinks)}
            ${upcomingHtml}
            <div style="margin-top: 16px; padding: 12px; background: #f5f5f7; border-radius: 8px; font-size: 11px; color: #6e6e73; text-align: center; line-height: 1.6;">
              By registering you agreed to the ohACCESS <a href="https://ohaccess.com/terms" style="color: #6e6e73;">Terms of Service</a>.<br/>
              You consent to be contacted by the host agent${sponsorConsentName ? ` and today's sponsor, ${escapeHtml(sponsorConsentName)}` : ''}.<br/>
              Reply STOP to any text to opt out · <a href="https://ohaccess.com/privacy" style="color: #6e6e73;">Privacy Policy</a><br/>
              <em style="color: #6e6e73;">Heads up: opting out blocks codewords for all future ohACCESS open houses.</em>
            </div>
          </div>
        </div>
      `
      })
      emailMessageId = visitorEmail.data?.id ?? null
    } catch (err) {
      // A failed email must not fail the caller — the visitor may still have
      // their SMS code, and the agent can read the codeword off the dashboard.
      console.error('Visitor codeword email send failed:', err)
    }
  }

  // Record the provider message ids so the Resend / Twilio status webhooks
  // can match later delivery events (bounce / undelivered) back to this
  // visitor. Only the attempted channels are written, so a partial release
  // (e.g. SMS-only) can't blank the other channel's ids. Best-effort: a
  // bookkeeping failure must not fail the caller.
  const update: Record<string, unknown> = {}
  if (channels.email) update.email_message_id = emailMessageId
  if (channels.sms) {
    update.sms_message_sid = visitorSms?.sid ?? null
    // Which channel carried (or was meant to carry) the codeword — the
    // dashboard labels WhatsApp deliveries so the agent knows what to ask
    // the visitor to show. Null (= SMS) for plain SMS sends, so an SMS-only
    // deployment never touches the column and doesn't depend on migration
    // 048 having run.
    if (channelUsed === 'whatsapp') update.codeword_channel = channelUsed
    // A send-time rejection won't get a delivery callback, so flag it now.
    if (smsSendFailed) {
      update.sms_status = 'failed'
      update.delivery_updated_at = new Date().toISOString()
    }
  }
  const { error: deliveryIdErr } = await supabase
    .from('visitors')
    .update(update)
    .eq('id', visitorId)
  if (deliveryIdErr) {
    console.error('Failed to store delivery message ids', deliveryIdErr)
  }
}
