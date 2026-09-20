import { escapeHtml } from './escape-html'
import { safeUrl, type UpcomingOpenHouse } from './register-helpers'
import { buildAgentCardHtml, buildSponsorCardHtml, type SponsorCard } from './email-cards'
import { brandedEmailShell, emailButton, emailEyebrow, emailSection } from './email-shell'

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

// Two made-up open houses for the dashboard preview of this email, shown when
// the agent has nothing scheduled, so they can see what their visitors would
// get if they did. Next weekend (Saturday + Sunday, at least 2 days out), in
// the same city as the open house being previewed. Never sent to anyone.
const EXAMPLE_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const EXAMPLE_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function exampleUpcomingOpenHouses(
  oh: { city?: string | null; state?: string | null; listing_price?: string | null; bedrooms?: string | null; bathrooms?: string | null },
  now: Date
): UpcomingOpenHouse[] {
  const sat = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2))
  while (sat.getUTCDay() !== 6) sat.setUTCDate(sat.getUTCDate() + 1)
  const sun = new Date(sat.getTime() + 86_400_000)
  const label = (d: Date) => `${EXAMPLE_DAYS[d.getUTCDay()]}, ${EXAMPLE_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
  const at = (d: Date, hourUtc: number) => new Date(d.getTime() + hourUtc * 3_600_000).toISOString()
  const place = [oh.city, oh.state].map(s => (s || '').trim()).filter(Boolean).join(', ')
  const address = (street: string) => (place ? `${street}, ${place}` : street)
  return [
    {
      id: 'example-1', property_address: address('123 Example Lane'), city: oh.city || null,
      open_house_date: label(sat), open_house_hours: '1:00 PM – 4:00 PM',
      listing_price: oh.listing_price || null, bedrooms: oh.bedrooms || '3', bathrooms: oh.bathrooms || '2',
      start_at: at(sat, 18), end_at: at(sat, 21),
    },
    {
      id: 'example-2', property_address: address('456 Sample Court'), city: oh.city || null,
      open_house_date: label(sun), open_house_hours: '12:00 PM – 2:00 PM',
      listing_price: null, bedrooms: '4', bathrooms: '3',
      start_at: at(sun, 17), end_at: at(sun, 19),
    },
  ]
}

// Moved to the shared email cards; re-exported for existing imports.
export { agentInitials } from './email-cards'

export type ThankYouSponsorCard = SponsorCard

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
  agentLicenseNumber: string | null
  agentLicenseState: string | null
  agentInfoUrl: string | null // "Agent information" link
  listingUrl: string | null
  facts: string | null   // "$625,000 · 4 bd · 3 ba · 2,450 sqft"
  feedbackUrl: string | null // /feedback/<token> — null once feedback is in
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
  const listingSection = (listingUrl || o.facts) ? emailSection(`
      ${emailEyebrow('The home you visited', accent)}
      <div style="font-size:15px;font-weight:700;color:#1d1d1f;">${e(o.fullAddress)}</div>
      ${o.facts ? `<div style="font-size:14px;color:#6e6e73;margin-top:3px;">${e(o.facts)}</div>` : ''}
      ${listingUrl ? emailButton('View the listing &rarr;', e(listingUrl), o) : ''}`) : ''

  // "How was the home?" — the after-your-tour questions from the sign-in
  // success screen, offered again here because most visitors pocket the phone
  // at the codeword and never see them. Omitted once feedback is in.
  const feedbackUrl = safeUrl(o.feedbackUrl)
  const feedbackSection = feedbackUrl ? emailSection(`
      ${emailEyebrow('How was the home?', accent)}
      <div style="font-size:14px;color:#444;line-height:1.6;">Your quick impressions help the seller. It takes about 30 seconds.</div>
      ${emailButton('Share your feedback &rarr;', e(feedbackUrl), o)}`) : ''

  // Agent card + logo, and the sponsor card + logo (only when the visit was
  // sponsored): the shared builders every visitor email uses, so they match.
  const agentCardHtml = buildAgentCardHtml({
    name: o.agentName, brokerage: o.brokerage, email: o.agentEmail, phone: o.agentPhone,
    licenseNumber: o.agentLicenseNumber, licenseState: o.agentLicenseState,
    headshotUrl: o.headshotUrl, logoUrl: o.agentLogoUrl, infoUrl: o.agentInfoUrl,
  }, {
    primary, accent,
    heading: 'Want to see it again, or tour more homes?',
    blurb: "Just reply to this email or give me a call. I'm happy to set up a private showing whenever works for you.",
  })
  const sponsorHtml = o.sponsor ? buildSponsorCardHtml(o.sponsor, { accent }) : ''

  const subject = `Thanks for visiting ${o.street}`

  // Same order as every visitor email: content, agent card, sponsor card,
  // then the extras (upcoming open houses).
  const html = brandedEmailShell({
    brand: o,
    bodyHtml: `
          <div style="font-size:22px;font-weight:800;color:#1d1d1f;">Thanks for stopping by.</div>
          <div style="font-size:15px;color:#444;line-height:1.6;margin-top:10px;">Hi ${e(o.visitorFirst)}, thanks for visiting the open house at <strong>${street}</strong>${cityBit} yesterday. It was great to have you.</div>

          ${listingSection}
          ${feedbackSection}

          ${agentCardHtml}
          ${sponsorHtml}

          ${o.upcomingHtml}`,
    footerHtml: `You're receiving this because you signed in at ${e(o.agentName)}'s open house at ${e(o.fullAddress)} on ${e(o.dateLabel)}.`,
  })

  return { subject, html }
}
