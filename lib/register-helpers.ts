import { escapeHtml } from './escape-html'

// Pure helpers for the visitor-registration flow. Kept free of side-effecting
// imports (no Twilio/Resend/Supabase clients) so they can be unit-tested in
// isolation — the register route imports them back in.

// Max characters for a single SMS segment. Optional links are only appended to
// the code-word text while the message still fits inside this budget, so a long
// listing URL can't push the SMS into multi-segment (extra cost) or rejection.
export const SMS_MAX_LENGTH = 160

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
// the caller. Each row shows day · time · city, a Google-Maps-linked address,
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
    const when = [oh.open_house_date, oh.open_house_hours, oh.city]
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
}): string {
  const fullName = `${lead.firstName} ${lead.lastName}`.trim()
  const e = escapeHtml
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
Registered: ${e(lead.registeredAt)}
</p>
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
