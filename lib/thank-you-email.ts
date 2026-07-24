import { escapeHtml } from './escape-html'
import { safeUrl } from './register-helpers'

// The post-event visitor "thanks for visiting" email — sent the morning after
// the open house. Pure builder + timing helpers so they can be unit-tested; the
// cron (app/api/cron/thank-you) assembles the data and sends.

// When the next-morning email is due. Anchored to the visitor's LOCAL visit
// date (registered_at in the property's timezone): the email goes out at 9:00+
// local on the following calendar day, so the copy's "yesterday" is always
// accurate. If that morning is missed (e.g. cron downtime), we 'skip' rather
// than send wrong-day copy.
export function thankYouSendState(
  registeredAtIso: string,
  timezone: string | null | undefined,
  now: Date
): 'send' | 'wait' | 'skip' {
  const tz = timezone || 'America/Chicago'
  const reg = localParts(new Date(registeredAtIso), tz)
  const cur = localParts(now, tz)
  const regDay = Date.UTC(reg.year, reg.month - 1, reg.day)
  const curDay = Date.UTC(cur.year, cur.month - 1, cur.day)
  const dayDiff = Math.round((curDay - regDay) / 86_400_000)
  if (dayDiff < 1) return 'wait'         // still the visit day — too early
  if (dayDiff > 1) return 'skip'         // missed the next-morning window
  return cur.hour >= 9 ? 'send' : 'wait' // the morning after: hold until 9am local
}

function localParts(d: Date, tz: string): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  let hour = get('hour')
  if (hour === 24) hour = 0 // some engines emit '24' for local midnight
  return { year: get('year'), month: get('month'), day: get('day'), hour }
}

// Initials for the fallback avatar when the agent has no headshot photo.
export function agentInitials(name: string | null | undefined): string {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const first = words[0][0] || ''
  const last = words.length > 1 ? words[words.length - 1][0] || '' : ''
  return (first + last).toUpperCase()
}

export type ThankYouSponsorCard = {
  name: string
  company: string | null
  email: string | null
  phone: string | null
  logoUrl: string | null
}

export type ThankYouEmailOpts = {
  appUrl: string
  primary: string        // brand header background (validated hex)
  accent: string         // brand accent (validated hex)
  onPrimary: string      // readable text on `primary`
  onAccent: string       // readable text on `accent`
  visitorFirst: string
  street: string         // e.g. "4124 Cory Lee Court"
  city: string | null
  fullAddress: string    // e.g. "4124 Cory Lee Court, Arlington, TX"
  dateLabel: string      // visit date in property tz, e.g. "Jul 24, 2026"
  agentName: string
  brokerage: string | null
  headshotUrl: string | null
  agentLogoUrl: string | null
  agentPhone: string | null
  agentEmail: string     // where replies go (agent's public/display email)
  listingUrl: string | null
  facts: string | null   // "$625,000 · 4 bd · 3 ba · 2,450 sqft"
  upcomingHtml: string   // pre-rendered by buildUpcomingOpenHousesHtml ('' if none)
  sponsor: ThankYouSponsorCard | null
}

export function buildThankYouEmail(o: ThankYouEmailOpts): { subject: string; html: string } {
  const e = escapeHtml
  const primary = o.primary, accent = o.accent
  const street = e(o.street)
  const cityBit = o.city ? ` in <strong>${e(o.city)}</strong>` : ''

  // Listing recap — only when there's a link or facts to show.
  const listingUrl = safeUrl(o.listingUrl)
  const listingSection = (listingUrl || o.facts) ? `
    <div style="background:#f6f7f9;border-radius:12px;padding:16px 18px;margin:18px 0;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${accent};text-transform:uppercase;margin-bottom:6px;">The home you visited</div>
      <div style="font-size:15px;font-weight:700;color:#1d1d1f;">${e(o.fullAddress)}</div>
      ${o.facts ? `<div style="font-size:14px;color:#6e6e73;margin-top:3px;">${e(o.facts)}</div>` : ''}
      ${listingUrl ? `<a href="${e(listingUrl)}" style="display:inline-block;margin-top:12px;background:${accent};color:${o.onAccent};text-decoration:none;font-size:14px;font-weight:700;padding:9px 16px;border-radius:8px;">View the listing &rarr;</a>` : ''}
    </div>` : ''

  // Agent avatar: real headshot when set, initials circle otherwise.
  const headshot = safeUrl(o.headshotUrl)
  const initials = agentInitials(o.agentName)
  const avatar = headshot
    ? `<img src="${e(headshot)}" width="52" height="52" alt="" style="width:52px;height:52px;border-radius:50%;object-fit:cover;display:block;">`
    : `<div style="width:52px;height:52px;border-radius:50%;background:${accent};color:${o.onAccent};text-align:center;line-height:52px;font-weight:800;font-size:18px;">${e(initials)}</div>`

  const agentLogo = safeUrl(o.agentLogoUrl)
  const agentLogoBlock = agentLogo
    ? `<div style="text-align:center;margin:12px 0 2px;"><img src="${e(agentLogo)}" alt="${e(o.brokerage || '')}" style="max-height:40px;max-width:60%;object-fit:contain;"></div>`
    : ''

  const phoneBit = o.agentPhone
    ? `<a href="tel:${e(o.agentPhone)}" style="color:${accent};text-decoration:none;font-weight:600;">${e(o.agentPhone)}</a> &middot; `
    : ''

  // Sponsor card + logo below — only when the visit was sponsored.
  const sp = o.sponsor
  const sponsorLogo = sp ? safeUrl(sp.logoUrl) : ''
  const sponsorContact = sp
    ? [sp.company ? e(sp.company) : '', sp.phone ? e(sp.phone) : '', sp.email ? e(sp.email) : ''].filter(Boolean).join(' &middot; ')
    : ''
  const sponsorSection = sp ? `
    <div style="background:#fdfaf3;border:1px solid #ead9ad;border-radius:12px;padding:16px 18px;margin:18px 0;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#8a6a1f;text-transform:uppercase;margin-bottom:6px;">Sponsored by</div>
      <div style="font-size:15px;font-weight:700;color:#1d1d1f;">${e(sp.name)}</div>
      ${sponsorContact ? `<div style="font-size:13px;color:#6e6e73;">${sponsorContact}</div>` : ''}
      <div style="font-size:11px;color:#8e8e93;margin-top:8px;line-height:1.5;">You are not required to use ${e(sp.company || sp.name)} for any service. You are free to shop around.</div>
    </div>
    ${sponsorLogo ? `<div style="text-align:center;margin:2px 0 4px;"><img src="${e(sponsorLogo)}" alt="${e(sp.company || sp.name)}" style="max-height:34px;max-width:60%;object-fit:contain;"></div>` : ''}` : ''

  const subject = `Thanks for visiting ${o.street}`

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#eceef1;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceef1;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td style="background:${primary};text-align:center;padding:28px 20px;">
          <div style="font-size:30px;font-weight:400;letter-spacing:-1px;color:${o.onPrimary};">oh<b style="font-weight:800;">ACCESS</b></div>
        </td></tr>
        <tr><td style="padding:28px 26px;">
          <div style="font-size:22px;font-weight:800;color:#1d1d1f;">Thanks for stopping by.</div>
          <div style="font-size:15px;color:#444;line-height:1.6;margin-top:10px;">Hi ${e(o.visitorFirst)}, thanks for visiting the open house at <strong>${street}</strong>${cityBit} yesterday &mdash; it was great to have you.</div>

          ${listingSection}

          <div style="font-size:15px;color:#444;line-height:1.6;margin:18px 0 14px;">Questions about this home, or want to see it again? Just reply to this email or give me a call &mdash; happy to set up a private showing whenever works for you.</div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border-radius:12px;">
            <tr>
              <td style="padding:14px 0 14px 16px;width:66px;vertical-align:middle;">${avatar}</td>
              <td style="padding:14px 16px 14px 12px;vertical-align:middle;">
                <div style="font-size:15px;font-weight:700;color:#1d1d1f;">${e(o.agentName)}</div>
                ${o.brokerage ? `<div style="font-size:13px;color:#6e6e73;">${e(o.brokerage)}</div>` : ''}
                <div style="font-size:13px;margin-top:3px;">${phoneBit}<a href="mailto:${e(o.agentEmail)}" style="color:${accent};text-decoration:none;">${e(o.agentEmail)}</a></div>
              </td>
            </tr>
          </table>
          ${agentLogoBlock}

          ${o.upcomingHtml}
          ${sponsorSection}

          <div style="border-top:1px solid #ececf0;margin-top:24px;padding-top:14px;font-size:11px;color:#9a9aa0;line-height:1.5;text-align:center;">
            You're receiving this because you signed in at ${e(o.agentName)}'s open house at ${e(o.fullAddress)} on ${e(o.dateLabel)}.<br>
            Powered by ohACCESS.com &middot; Patent Pending
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return { subject, html }
}
