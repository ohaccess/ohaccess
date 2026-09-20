import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import twilio from 'twilio'
import { Resend } from 'resend'
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
import { resolveEmailBranding } from '@/lib/email-shell'
import { buildCodewordEmail, type CodewordSponsor, type CodewordBrokerage } from '@/lib/codeword-email'
import {
  buildSmsBody,
  smsLink,
  isHttpUrl,
  twilioStatusCallbackUrl,
  twilioSender,
  agentCopyRecipients,
  resolveDisclosureLinks,
  buildUpcomingOpenHousesHtml,
  type DisclosureLink,
  type UpcomingOpenHouse,
} from '@/lib/register-helpers'

export type { CodewordSponsor, CodewordBrokerage }

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
// The email's HTML lives in lib/codeword-email (pure builder, shared with the
// dashboard's visitor-email preview).
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
    // ISO code of the property's country (migration 048); decides sq ft vs m².
    country?: string | null
  }
  agent: {
    full_name?: string | null
    brokerage?: string | null
    display_email?: string | null
    email?: string | null
    license_number?: string | null
    state?: string | null
    headshot_url?: string | null
    primary_color?: string | null
    accent_color?: string | null
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

  // Team/brokerage branding + disclosure links (brokerage overrides agent).
  let brokerageRow = params.brokerageRow
  if (brokerageRow === undefined) {
    brokerageRow = null
    if (agent?.brokerage_id) {
      const { data } = await supabase
        .from('brokerages')
        .select('primary_color, accent_color, logo_url, disclosure_links')
        .eq('id', agent.brokerage_id)
        .maybeSingle()
      brokerageRow = data ?? null
    }
  }
  const disclosureLinks =
    params.disclosureLinks ??
    resolveDisclosureLinks(agent?.disclosure_links, brokerageRow?.disclosure_links)

  // Two code words: the SMS (text) word is primary; the email word is a
  // fallback (see lib/codeword-email).
  const smsCodeWord = openHouse.code_word
  const streetAddress = openHouse.street_address || openHouse.property_address
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
        ...(listingShortUrl ? [{ label: '', url: smsLink(listingShortUrl) }] : []),
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

  // ② VISITOR EMAIL
  let emailMessageId: string | null = null
  if (channels.email) {
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
      upcomingHtml = buildUpcomingOpenHousesHtml((upcoming || []) as UpcomingOpenHouse[], APP_URL, resolveEmailBranding(agent, brokerageRow && { accent_color: brokerageRow.accent_color }).accent)
    } catch (err) {
      console.error('Upcoming open houses lookup failed:', err)
    }

    const { subject, html } = buildCodewordEmail({
      openHouse,
      agent: agent ? { ...agent, phone: (agent as { phone?: string | null }).phone } : null,
      brokerageRow,
      sponsor,
      disclosureLinks,
      listingShortUrl,
      agentShortUrl,
      sponsorShortUrl,
      upcomingHtml,
    })

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
        subject,
        html,
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
