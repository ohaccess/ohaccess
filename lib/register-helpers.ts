import { escapeHtml } from './escape-html'

// Pure helpers for the visitor-registration flow. Kept free of side-effecting
// imports (no Twilio/Resend/Supabase clients) so they can be unit-tested in
// isolation — the register route imports them back in.

// Max characters for a single SMS segment. Optional links are only appended to
// the code-word text while the message still fits inside this budget, so a long
// listing URL can't push the SMS into multi-segment (extra cost) or rejection.
export const SMS_MAX_LENGTH = 160

// The SMS code word is the only free-text field an agent can drop into the
// visitor's text, so it's the only thing that can push that message past one
// billable segment. The fixed wrapper ("Codeword at ... is "...". Share with
// host for access. Reply STOP to opt out.") is 70 characters, which leaves 90
// for the address plus the code word.
//
// The binding constraint isn't the segment, though — it's the optional short
// listing link (31 chars + a space). With the link attached, the address and
// code word share a 58-character budget, so 12 leaves 46 for the address —
// which since the zip was added (", 90210", 7 chars, so iPhone Maps links
// resolve to the right town) means 39 for the street itself.
// Past that buildSmsBody drops the link rather than spilling into a second
// segment, and the visitor gets the listing link in their email instead. Every
// character shaved off this cap is a character of address that still fits WITH
// the link, which is why it sits at 12 rather than higher — 12 still clears
// the longest generated word (WELCOMING, 9) with room for a custom code.
export const SMS_CODE_WORD_MAX_LENGTH = 12

// Letters and digits only, uppercased, truncated to the cap above.
//
// The character filter matters more than the length cap: one emoji, curly
// quote, or accented letter flips the whole message from GSM-7 to UCS-2
// encoding, which drops the single-segment limit from 160 to 70 — less than
// the wrapper plus a typical address already needs. That would double the
// Twilio cost of every text sent from that open house. It also keeps the code
// word to something a visitor can read aloud at the door.
//
// The EMAIL code word is deliberately left alone — email has no segments and
// no encoding cliff, so emoji and long phrases are fine there.
export function sanitizeSmsCodeWord(value: string | null | undefined): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, SMS_CODE_WORD_MAX_LENGTH)
}

// Random 8-char alphanumeric slug for a short URL.
export function generateCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Safely append optional URLs without exceeding SMS_MAX_LENGTH. An empty
// label appends the bare URL (saves characters so links fit more addresses).
export function buildSmsBody(base: string, extras: { label: string; url: string }[]): string {
  let body = base
  for (const extra of extras) {
    const candidate = `${body} ${extra.label ? `${extra.label}: ` : ''}${extra.url}`
    if (candidate.length <= SMS_MAX_LENGTH) body = candidate
  }
  return body
}

// Twilio signs its status callback over the exact URL it calls. The apex
// domain (ohaccess.com) 307-redirects to www, and the signature no longer
// validates after that hop — every callback was bouncing with a 403. So the
// callback URL must always be the www host, called directly with no redirect.
export function twilioStatusCallbackUrl(appUrl: string): string {
  const origin = appUrl.replace(/^https:\/\/ohaccess\.com/i, 'https://www.ohaccess.com')
  return `${origin.replace(/\/$/, '')}/api/webhooks/twilio-status`
}

// Which sender Twilio should send as. Prefer the Messaging Service: it carries
// the branded STOP/HELP auto-replies (Advanced Opt-Out), which the bare number
// can't — a bare number answers HELP with Twilio's generic default, naming
// neither ohACCESS nor a support contact, which CTIA expects a HELP reply to do.
//
// Falls back to the bare number when the SID isn't set, so a missing env var
// degrades to the old behavior instead of taking SMS down mid-open-house.
export function twilioSender(): { messagingServiceSid: string } | { from: string } {
  const sid = process.env.TWILIO_MESSAGING_SERVICE_SID
  return sid ? { messagingServiceSid: sid } : { from: process.env.TWILIO_PHONE_NUMBER! }
}

// Only http(s) URLs are allowed to be forwarded/embedded — blocks javascript:,
// data:, file:, and other schemes (and, for outbound calls, non-web targets).
export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false
  return /^https?:\/\//i.test(value)
}

export function safeUrl(value: string | null | undefined): string {
  return isHttpUrl(value) ? value : ''
}

export function isHexColor(value: string | null | undefined): boolean {
  return !!value && /^#[0-9a-fA-F]{3,8}$/.test(value)
}

// ---------------------------------------------------------------------------
// Disclosures & notices
//
// ohACCESS is plumbing here, not a compliance authority. The agent (or their
// brokerage) supplies BOTH the label and the URL for whatever notice their
// state or broker requires — an IABS, a Consumer Information Statement, an
// agency disclosure. We render those links on the sign-in success screen and
// in the code-word email and record what was sent. We never decide which form
// applies, host the document, or collect a signature.
// ---------------------------------------------------------------------------

export type DisclosureLink = { label: string; url: string }

// How many links an agent may configure, and how long a label may be. Both are
// enforced here (not just in the settings UI) because the stored jsonb is the
// only thing the register route trusts.
export const MAX_DISCLOSURE_LINKS = 5
export const MAX_DISCLOSURE_LABEL_LENGTH = 80

// Coerce whatever is sitting in the jsonb column into a clean, safe list.
// Anything malformed is dropped rather than thrown: a bad row in settings must
// never be able to break a visitor's sign-in.
//
// https-only (not just http(s)) — these links are rendered in email sent from
// our domain to consumers, so an insecure target is not worth the deliverability
// and trust cost. Labels are trimmed and length-capped; escaping happens at
// render time, not here, so the stored value stays the agent's literal text.
export function normalizeDisclosureLinks(value: unknown): DisclosureLink[] {
  if (!Array.isArray(value)) return []
  const out: DisclosureLink[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const { label, url } = raw as { label?: unknown; url?: unknown }
    if (typeof label !== 'string' || typeof url !== 'string') continue
    const cleanLabel = label.trim().slice(0, MAX_DISCLOSURE_LABEL_LENGTH)
    const cleanUrl = url.trim()
    if (!cleanLabel) continue
    if (!/^https:\/\//i.test(cleanUrl)) continue
    out.push({ label: cleanLabel, url: cleanUrl })
    if (out.length >= MAX_DISCLOSURE_LINKS) break
  }
  return out
}

// Brokerage links OVERRIDE the agent's, matching the existing logo/colors
// precedence: what gets handed to a visitor is a broker-level control, not an
// individual agent preference. A brokerage that has configured NOTHING falls
// through to the agent's own list rather than blanking it.
export function resolveDisclosureLinks(
  agentLinks: unknown,
  brokerageLinks: unknown
): DisclosureLink[] {
  const brokerage = normalizeDisclosureLinks(brokerageLinks)
  if (brokerage.length > 0) return brokerage
  return normalizeDisclosureLinks(agentLinks)
}

// The disclosures block for the visitor's code-word email. Returns '' when the
// agent has configured none, so the email simply omits the section. Labels are
// agent-entered, so both label and URL are escaped before interpolation.
export function buildDisclosuresHtml(links: DisclosureLink[]): string {
  if (links.length === 0) return ''
  const e = escapeHtml
  const items = links.map(l => `
              <div style="padding: 6px 0; font-size: 13px;">
                <a href="${e(l.url)}" style="color: #0071e3;">${e(l.label)}</a>
              </div>`).join('')
  return `
            <div style="background: #f5f5f7; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
              <div style="font-size: 11px; color: #6e6e73; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin-bottom: 8px;">Disclosures &amp; Notices</div>
              <div style="font-size: 12px; color: #6e6e73; text-align: center; margin-bottom: 4px;">Provided by your host agent.</div>${items}
            </div>`
}

export function isEmail(value: string | null | undefined): value is string {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

// Picks who gets the agent's copy of a visitor's code email. A CC is visible
// to the visitor, so the visible copy goes to the agent's public display email
// (falling back to their login email only if no display email is set). The
// login email additionally gets a HIDDEN bcc copy as a safety net — deduped so
// a single address that serves as both isn't emailed twice. Invalid/missing
// addresses are dropped.
export function agentCopyRecipients(
  displayEmail: string | null | undefined,
  loginEmail: string | null | undefined
): { cc: string[]; bcc: string[] } {
  const cc = isEmail(displayEmail)
    ? displayEmail.trim()
    : (isEmail(loginEmail) ? loginEmail.trim() : null)
  const bcc = isEmail(loginEmail) && loginEmail.trim() !== cc ? loginEmail.trim() : null
  return { cc: cc ? [cc] : [], bcc: bcc ? [bcc] : [] }
}

// One row of the "Upcoming Open Houses" section in the visitor's code email.
// Fields mirror the open_houses columns the register route selects.
export type UpcomingOpenHouse = {
  id: string
  property_address: string | null
  city: string | null
  open_house_date: string | null
  open_house_hours: string | null
  listing_price: string | null
  bedrooms: string | null
  bathrooms: string | null
  start_at: string | null
  end_at: string | null
}

// Compact UTC stamp for Google Calendar links: 2026-07-18T18:00:00Z -> 20260718T180000Z
function calendarStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// Prefilled "add event" link for Google Calendar. Shared by the visitor
// email's upcoming-open-houses section and the map pin cards.
export function googleCalendarUrl(title: string, startIso: string, endIso: string, location: string): string {
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${calendarStamp(startIso)}/${calendarStamp(endIso)}&location=${encodeURIComponent(location)}`
}

// Builds the "Upcoming Open Houses" block for the visitor email: the agent's
// (and their team's) open houses over the next 10 days, pre-filtered/sorted by
// the caller. Each row shows day · time, a Google-Maps-linked address (which
// carries the city; the city joins the when-line only when the address is
// missing),
// price + beds/baths, and add-to-calendar links (Google/Outlook are prefill
// URLs; Apple has no URL scheme, so it points at our downloadable .ics
// endpoint). Returns '' when there's nothing upcoming — the email simply
// omits the section. All values are agent-entered, so everything is escaped.
export function buildUpcomingOpenHousesHtml(houses: UpcomingOpenHouse[], appUrl: string): string {
  if (houses.length === 0) return ''
  const e = escapeHtml

  const items = houses.map(oh => {
    const address = oh.property_address || ''
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    // The city only rides the when-line if there's no address row to carry it.
    const when = [oh.open_house_date, oh.open_house_hours, address ? null : oh.city]
      .filter(Boolean).map(v => e(String(v))).join(' &middot; ')

    // Calendar links need concrete times; legacy rows without end_at fall back
    // to a zero-length event rather than losing the buttons entirely.
    let calendarLine = ''
    if (oh.start_at) {
      const start = oh.start_at
      const end = oh.end_at || oh.start_at
      const title = `Open House — ${address}`.trim()
      const googleUrl = googleCalendarUrl(title, start, end, address)
      const outlookUrl = `https://outlook.live.com/calendar/0/action/compose?rru=addevent&subject=${encodeURIComponent(title)}&startdt=${encodeURIComponent(start)}&enddt=${encodeURIComponent(end)}&location=${encodeURIComponent(address)}`
      const appleUrl = `${appUrl}/api/open-house/${oh.id}/calendar`
      calendarLine = `<div style="font-size: 12px; color: #6e6e73; margin-top: 2px;">📅 Add to calendar: <a href="${e(googleUrl)}" style="color: #0071e3;">Google</a> &middot; <a href="${e(outlookUrl)}" style="color: #0071e3;">Outlook</a> &middot; <a href="${e(appleUrl)}" style="color: #0071e3;">Apple</a></div>`
    }

    const facts = [
      oh.listing_price ? `💰 ${e(oh.listing_price)}` : '',
      oh.bedrooms ? `🛏 ${e(oh.bedrooms)} bed` : '',
      oh.bathrooms ? `🛁 ${e(oh.bathrooms)} bath` : '',
    ].filter(Boolean).join(' &middot; ')

    return `
              <div style="padding: 10px 0; border-top: 1px solid #e5e5ea; font-size: 13px; line-height: 1.7;">
                <div style="color: #1d1d1f; font-weight: 700;">${when}</div>
                ${address ? `<div><a href="${e(mapsUrl)}" style="color: #0071e3;">${e(address)}</a></div>` : ''}
                ${facts ? `<div style="color: #6e6e73;">${facts}</div>` : ''}
                ${calendarLine}
              </div>`
  }).join('')

  return `
            <div style="background: #f5f5f7; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
              <div style="font-size: 11px; color: #6e6e73; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin-bottom: 8px;">Upcoming Open Houses</div>
              <div style="font-size: 12px; color: #6e6e73; text-align: center; margin-bottom: 6px;">Come explore our other listings.</div>${items}
            </div>`
}

// Builds the lead-notification email we send to an agent's CRM intake address.
// Two layers of coverage:
//   1. A clearly-labeled human-readable body — every CRM email parser (Follow Up
//      Boss, BoldTrail, Lofty, Sierra, Real Geeks, …) is tuned to read "Name:",
//      "Email:", "Phone:" style lead alerts, so this works almost everywhere.
//   2. Lead Metadata Spec v1.0 meta tags (leadmetadata.org) for CRMs that support
//      the real-estate standard and parse structured fields directly.
// All visitor/agent-controlled values are escaped before interpolation.
export function buildCrmLeadEmail(lead: {
  firstName: string
  lastName: string
  email: string
  phone: string
  purchasingTimeline: string
  propertyAddress: string
  agentName: string
  registeredAt: string
  visitorUrl: string
  customAnswers?: { prompt: string; answer: string }[]
}): string {
  const fullName = `${lead.firstName} ${lead.lastName}`.trim()
  const e = escapeHtml
  // Answers to the agent's own questions, appended as more "Label: value" lines
  // so the CRM email parsers that read this format pick them up too.
  const customLines = (lead.customAnswers || [])
    .map(a => `${e(a.prompt)}: ${e(a.answer)}<br/>`)
    .join('\n')
  return `<!DOCTYPE html>
<html>
<head>
<meta name="lead_information_version" content="1.0" />
<meta name="lead_name" content="${e(fullName)}" />
<meta name="lead_email" content="${e(lead.email)}" />
<meta name="lead_phone" content="${e(lead.phone)}" />
<meta name="lead_source" content="ohACCESS" />
<meta name="lead_message" content="Open-house sign-in. Purchasing timeline: ${e(lead.purchasingTimeline || 'Not specified')}." />
<meta name="lead_property_address" content="${e(lead.propertyAddress)}" />
</head>
<body>
<p>New lead from an ohACCESS open-house sign-in.</p>
<p>
Name: ${e(fullName)}<br/>
Email: ${e(lead.email)}<br/>
Phone: ${e(lead.phone)}<br/>
Purchasing Timeline: ${e(lead.purchasingTimeline || 'Not specified')}<br/>
Property: ${e(lead.propertyAddress)}<br/>
Listing Agent: ${e(lead.agentName)}<br/>
Source: ohACCESS<br/>
Registered: ${e(lead.registeredAt)}<br/>
${customLines}</p>
<p>Visitor details: <a href="${e(lead.visitorUrl)}">${e(lead.visitorUrl)}</a></p>
</body>
</html>`
}

// Is this Twilio Lookup line type an internet/VoIP app number (TextNow,
// Google Voice, Pinger, ...) — the classic "burner app" signal? Only
// nonFixedVoip: fixedVoip is cable-company home phone service (Comcast
// Voice etc.), a perfectly normal residential line. Plenty of legitimate
// people use VoIP numbers too, so surface this as "extra scrutiny
// suggested", never as an accusation.
export function isVirtualNumber(lineType: string | null | undefined): boolean {
  return lineType === 'nonFixedVoip'
}

// ---- Phone-intel cache ------------------------------------------------------
// Every sign-in used to pay Twilio (~$0.008) for the number's carrier + line
// type, even when the same buyer had signed in at four other ohACCESS open
// houses that weekend. The answer is already on those earlier visitor rows
// (phone_carrier / phone_line_type, live and archived), so /api/register now
// checks there first and only calls Twilio for a number it hasn't seen.
//
// Two guards keep the reused value trustworthy — line type is the agent's
// burner-number signal, so a stale or wrong answer matters:
//   * Age: reuse only a result under PHONE_INTEL_MAX_AGE (12 months). Line
//     types drift when numbers are ported (landline → mobile, mobile → VoIP);
//     rare, but a yearly re-check costs a penny.
//   * Same person: reuse only when the earlier sign-in matches this visitor's
//     email OR full name. A number showing up under a different name AND
//     email may be a recycled number (carriers reassign them), whose line
//     type could have changed with its owner — so that pays for a fresh look.
// The earlier visitor's details are compared here and nothing else: the
// agent sees exactly the carrier/line type Twilio would have returned, never
// anything about where else the number signed in.
export const PHONE_INTEL_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000

// Newest-first rows to fetch from each of visitors / visitor_archive. Small
// on purpose: a shared household number might have a partner's sign-ins on
// top, and we want to find this visitor's own row beneath them.
export const PHONE_INTEL_CANDIDATES = 10

export type PhoneIntelCandidate = {
  first_name: string | null
  last_name: string | null
  email: string | null
  phone_carrier: string | null
  phone_line_type: string | null
  registered_at: string | null
}

export type PhoneIntel = { carrier: string | null; lineType: string }

function foldText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function pickCachedPhoneIntel(
  candidates: PhoneIntelCandidate[],
  visitor: { firstName: string; lastName: string; email: string },
  now: number = Date.now()
): PhoneIntel | null {
  const email = foldText(visitor.email)
  const name = foldText(`${visitor.firstName} ${visitor.lastName}`)
  const cutoff = now - PHONE_INTEL_MAX_AGE_MS

  const usable = candidates
    .map(c => ({ c, at: Date.parse(c.registered_at ?? '') }))
    .filter(({ c, at }) => !!c.phone_line_type && Number.isFinite(at) && at >= cutoff)
    .sort((a, b) => b.at - a.at)

  for (const { c } of usable) {
    const sameEmail = !!email && foldText(c.email) === email
    const sameName = !!name.trim() && foldText(`${c.first_name ?? ''} ${c.last_name ?? ''}`) === name
    if (sameEmail || sameName) {
      return { carrier: c.phone_carrier ?? null, lineType: c.phone_line_type as string }
    }
  }
  return null
}

// The Twilio Lookup line types, collapsed into the three kinds an agent
// actually acts on. Anything else Twilio can return (tollFree, voicemail,
// premium, unknown, ...) is left unlabelled rather than guessed at.
export type PhoneLineKind = 'mobile' | 'home' | 'virtual'

export function phoneLineKind(lineType: string | null | undefined): PhoneLineKind | null {
  if (lineType === 'mobile') return 'mobile'
  // Both can't receive texts: a real landline, and fixedVoip — cable-company
  // home phone service (Comcast Voice etc.), which is an ordinary house line.
  if (lineType === 'landline' || lineType === 'fixedVoip') return 'home'
  if (isVirtualNumber(lineType)) return 'virtual'
  return null
}

// How each kind is shown in the visitor log and the visitor detail panel, in
// one place so both stay identical. Mobile and home phone are neutral facts
// ('plain'); only the burner-app signal is styled as a warning.
export const PHONE_LINE_CHIPS: Record<PhoneLineKind, { label: string; tip: string; tone: 'plain' | 'warn' }> = {
  mobile: {
    label: '📱 Mobile',
    tip: 'A carrier mobile line — text messages reach this number.',
    tone: 'plain',
  },
  home: {
    label: '☎ Home phone',
    tip: "A home or office line (a landline, or cable-company phone service). It can't receive text messages — follow up by phone call or email.",
    tone: 'plain',
  },
  virtual: {
    label: '⚠ VoIP',
    tip: 'Internet/VoIP number (TextNow, Google Voice, …), not a carrier mobile line. Many are legitimate — consider extra ID verification.',
    tone: 'warn',
  },
}
