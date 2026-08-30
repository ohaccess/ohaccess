import { escapeHtml } from './escape-html'
import { safeUrl, googleCalendarUrl } from './register-helpers'
import { accentOnPrimary } from './colors'

// "Re-invite past visitors": pure helpers for deciding WHO an agent may
// invite to an upcoming open house, and for building the invite email.
// The API route (app/api/open-house/[id]/invites) assembles the data and
// sends; everything here is side-effect-free so it can be unit-tested.
//
// Consent basis: the sign-in clickwrap ("…consent to be contacted by the
// host agent … about this and other properties"). That consent is between
// the visitor and the HOST agent only, so eligibility is always scoped to
// one agent's own visitors — never across agents.

// How long a visitor stays invitable after a sign-in, keyed by their
// purchasing-timeline answer (the canonical en-dash strings from
// register-i18n TIMELINE_VALUES, plus two legacy pre-launch keys). Each
// window is padded ~1 month past the literal answer — real purchases run
// longer than buyers predict. A repeat visit resets the clock (see
// computeInviteAudience: most recent sign-in wins).
export const INVITE_WINDOW_MONTHS: Record<string, number> = {
  '0–3 Months': 4,
  '3–6 Months': 7,
  '6–12 Months': 13,
  '12+ Months': 16,
  // Legacy pre-launch options — treat like the shortest window.
  '0–1 Month': 4,
  '2–3 Months': 4,
}
// Unknown/missing timeline gets the shortest window — invite conservatively.
export const DEFAULT_WINDOW_MONTHS = 4

// Frequency cap: at most this many invites per visitor per rolling window,
// per agent — so an agent running many open houses can't flood a visitor.
export const INVITE_FREQUENCY_MAX = 2
export const INVITE_FREQUENCY_WINDOW_DAYS = 30

// Cap on a single batch — keeps one POST well inside serverless time limits.
export const INVITE_BATCH_MAX = 200

// Delivery statuses that mean the address is bad (same set as the thank-you
// cron) — never invite an address we know bounces or complained.
export const BAD_EMAIL_STATUSES = new Set(['bounced', 'complained', 'failed'])

export const normalizeEmail = (email: string | null | undefined): string =>
  String(email || '').trim().toLowerCase()

// When a visitor's invite window closes, given their timeline answer and
// sign-in time. Calendar-month arithmetic (Jan 31 + 1mo → Mar 3 is fine —
// precision doesn't matter at month scale).
export function inviteWindowEnd(timeline: string | null | undefined, registeredAtIso: string): Date {
  const months = INVITE_WINDOW_MONTHS[String(timeline || '')] ?? DEFAULT_WINDOW_MONTHS
  const d = new Date(registeredAtIso)
  d.setMonth(d.getMonth() + months)
  return d
}

export type InviteCandidate = {
  first_name: string | null
  last_name: string | null
  email: string | null
  email_status: string | null
  sms_opted_out?: boolean | null
  purchasing_timeline: string | null
  registered_at: string | null
  open_house_id: string | null
}

export type InviteMatch = {
  email: string           // normalized
  firstName: string
  lastName: string
  timeline: string | null
  lastVisitAt: string     // ISO of the winning (most recent) sign-in
  lastVisitOpenHouseId: string | null
}

export type InviteExcludedCounts = {
  optedOut: number        // email unsubscribe, or replied STOP to SMS
  badEmail: number        // bounced / complained / failed
  expired: number         // past their buying-timeline window
  alreadyInvited: number  // already invited to THIS open house
  frequencyCapped: number // hit the per-month invite cap
}

export type InviteAudience = { matches: InviteMatch[]; excluded: InviteExcludedCounts }

// The decision engine. Input is everything the DB knows; output is who to
// invite and an honest per-reason count of who was left out (surfaced to the
// agent as "6 not included — …").
//
// Rules, in order:
//   - unit is agent + email: all of one address's sign-ins collapse to one
//     entry, the most recent sign-in wins (its timeline + its clock)
//   - visitors of the TARGET open house are ignored (they're already coming)
//   - opted out (email unsubscribe or SMS STOP on any of their rows) → out
//   - any bounced/complained/failed send to the address → out
//   - past the timeline window → out (silent expiry)
//   - already invited to this open house → out (never twice)
//   - ≥ INVITE_FREQUENCY_MAX invites from this agent in the window → out
export function computeInviteAudience(input: {
  visitors: InviteCandidate[]
  targetOpenHouseId: string
  optedOutEmails: Set<string>          // normalized, from email_opt_outs
  alreadyInvitedEmails: Set<string>    // normalized, invites for the target OH
  recentInviteEmails: string[]         // normalized, one entry per invite this agent sent in the window
  now: Date
}): InviteAudience {
  const excluded: InviteExcludedCounts = { optedOut: 0, badEmail: 0, expired: 0, alreadyInvited: 0, frequencyCapped: 0 }

  // Collapse to one entry per address: latest sign-in wins; remember if ANY
  // row carried a bad-delivery or STOP flag (a signal on any visit counts).
  type Agg = { winner: InviteCandidate; anyBad: boolean; anySmsStop: boolean }
  const byEmail = new Map<string, Agg>()
  for (const v of input.visitors) {
    const email = normalizeEmail(v.email)
    if (!email || !v.registered_at) continue
    if (v.open_house_id === input.targetOpenHouseId) continue
    const bad = BAD_EMAIL_STATUSES.has(String(v.email_status || '').toLowerCase())
    const stop = !!v.sms_opted_out
    const cur = byEmail.get(email)
    if (!cur) {
      byEmail.set(email, { winner: v, anyBad: bad, anySmsStop: stop })
    } else {
      if (new Date(v.registered_at).getTime() > new Date(cur.winner.registered_at!).getTime()) cur.winner = v
      cur.anyBad = cur.anyBad || bad
      cur.anySmsStop = cur.anySmsStop || stop
    }
  }

  const recentCount = new Map<string, number>()
  for (const email of input.recentInviteEmails) {
    recentCount.set(email, (recentCount.get(email) || 0) + 1)
  }

  const matches: InviteMatch[] = []
  for (const [email, agg] of byEmail) {
    if (input.optedOutEmails.has(email) || agg.anySmsStop) { excluded.optedOut++; continue }
    if (agg.anyBad) { excluded.badEmail++; continue }
    const w = agg.winner
    if (input.now.getTime() > inviteWindowEnd(w.purchasing_timeline, w.registered_at!).getTime()) { excluded.expired++; continue }
    if (input.alreadyInvitedEmails.has(email)) { excluded.alreadyInvited++; continue }
    if ((recentCount.get(email) || 0) >= INVITE_FREQUENCY_MAX) { excluded.frequencyCapped++; continue }
    matches.push({
      email,
      firstName: w.first_name || '',
      lastName: w.last_name || '',
      timeline: w.purchasing_timeline,
      lastVisitAt: w.registered_at!,
      lastVisitOpenHouseId: w.open_house_id,
    })
  }

  // Soonest-expiring first = hottest buyers first (matters when a batch hits
  // INVITE_BATCH_MAX).
  matches.sort((a, b) =>
    inviteWindowEnd(a.timeline, a.lastVisitAt).getTime() - inviteWindowEnd(b.timeline, b.lastVisitAt).getTime())

  return { matches, excluded }
}

export type InviteEmailOpts = {
  appUrl: string
  primary: string        // brand header background (validated hex)
  accent: string         // brand accent (validated hex)
  onPrimary: string
  onAccent: string
  visitorFirst: string
  pastStreet: string | null   // street of the open house they visited, for the personal opener
  agentName: string
  brokerage: string | null
  headshotUrl: string | null
  agentPhone: string | null
  agentEmail: string          // where replies (and the "I'm coming!" button) go
  oh: {
    id: string
    fullAddress: string       // "123 Oak St, Palo Alto, CA 94301"
    street: string            // "123 Oak St"
    dateLabel: string         // "Sat, Aug 1" (property tz)
    hoursLabel: string | null // "2:00 PM – 4:00 PM"
    startAt: string | null
    endAt: string | null
    facts: string | null      // "$1,895,000 · 4 bd · 3 ba"
    listingUrl: string | null
  }
  unsubscribeUrl: string
}

// The invite email — agent-voiced, one open house front and center, with the
// Google-Maps-linked address and Google/Outlook/Apple add-to-calendar links
// (same link recipe as buildUpcomingOpenHousesHtml). Layout mirrors the
// thank-you email so a visitor sees one consistent voice from the agent.
export function buildInviteEmail(o: InviteEmailOpts): { subject: string; html: string } {
  const e = escapeHtml
  const street = e(o.oh.street)
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.oh.fullAddress)}`

  const opener = o.pastStreet
    ? `Hi ${e(o.visitorFirst)}, it&rsquo;s ${e(o.agentName)} &mdash; we met at my open house at <strong>${e(o.pastStreet)}</strong>. I&rsquo;m hosting another one and thought you might like to take a look.`
    : `Hi ${e(o.visitorFirst)}, it&rsquo;s ${e(o.agentName)}. Thanks again for visiting one of my open houses &mdash; I&rsquo;m hosting another one and thought you might like to take a look.`

  // Calendar links need concrete times; without start_at the line is dropped.
  let calendarLine = ''
  if (o.oh.startAt) {
    const start = o.oh.startAt
    const end = o.oh.endAt || o.oh.startAt
    const title = `Open House — ${o.oh.fullAddress}`.trim()
    const googleUrl = googleCalendarUrl(title, start, end, o.oh.fullAddress)
    const outlookUrl = `https://outlook.live.com/calendar/0/action/compose?rru=addevent&subject=${encodeURIComponent(title)}&startdt=${encodeURIComponent(start)}&enddt=${encodeURIComponent(end)}&location=${encodeURIComponent(o.oh.fullAddress)}`
    const appleUrl = `${o.appUrl}/api/open-house/${o.oh.id}/calendar`
    calendarLine = `<div style="font-size:12px;color:#6e6e73;border-top:1px solid #ececf0;margin-top:12px;padding-top:10px;">📅 Add to calendar: <a href="${e(googleUrl)}" style="color:${o.accent};">Google</a> &middot; <a href="${e(outlookUrl)}" style="color:${o.accent};">Outlook</a> &middot; <a href="${e(appleUrl)}" style="color:${o.accent};">Apple</a></div>`
  }

  const listingUrl = safeUrl(o.oh.listingUrl)
  const when = [o.oh.dateLabel, o.oh.hoursLabel].filter(Boolean).map(v => e(String(v))).join(' &middot; ')

  const rsvpSubject = encodeURIComponent(`I'll be at your open house — ${o.oh.street}, ${o.oh.dateLabel}`)
  const rsvpUrl = `mailto:${o.agentEmail}?subject=${rsvpSubject}`

  const phoneBit = o.agentPhone
    ? `<a href="tel:${e(o.agentPhone)}" style="color:${o.accent};text-decoration:none;font-weight:600;">${e(o.agentPhone)}</a> &middot; `
    : ''

  const headshot = safeUrl(o.headshotUrl)
  const initials = String(o.agentName || '').trim().split(/\s+/).filter(Boolean)
    .map((w, i, a) => (i === 0 || i === a.length - 1 ? w[0] : '')).join('').toUpperCase()
  const avatar = headshot
    ? `<img src="${e(headshot)}" width="52" height="52" alt="" style="width:52px;height:52px;border-radius:50%;object-fit:cover;display:block;">`
    : `<div style="width:52px;height:52px;border-radius:50%;background:${o.primary};color:${accentOnPrimary(o.primary, o.accent)};text-align:center;line-height:52px;font-weight:800;font-size:18px;">${e(initials)}</div>`

  const subject = `You're invited — open house at ${o.oh.street}, ${o.oh.dateLabel}`

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#eceef1;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceef1;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td style="background:${o.primary};text-align:center;padding:28px 20px;">
          <div style="font-size:30px;font-weight:200;letter-spacing:-1px;color:${o.onPrimary};">oh<b style="font-weight:800;">ACCESS</b></div>
        </td></tr>
        <tr><td style="padding:28px 26px;">
          <div style="font-size:22px;font-weight:800;color:#1d1d1f;">You&rsquo;re invited.</div>
          <div style="font-size:15px;color:#444;line-height:1.6;margin-top:10px;">${opener}</div>

          <div style="background:#f6f7f9;border-radius:12px;padding:16px 18px;margin:18px 0;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${o.accent};text-transform:uppercase;margin-bottom:6px;text-align:center;">Upcoming Open House</div>
            <div style="font-size:15px;font-weight:700;color:#1d1d1f;">${when}</div>
            <div style="font-size:15px;margin-top:3px;">📍 <a href="${e(mapsUrl)}" style="color:${o.accent};">${e(o.oh.fullAddress)}</a></div>
            ${o.oh.facts ? `<div style="font-size:14px;color:#6e6e73;margin-top:3px;">${e(o.oh.facts)}</div>` : ''}
            ${listingUrl ? `<a href="${e(listingUrl)}" style="display:inline-block;margin-top:12px;background:${o.accent};color:${o.onAccent};text-decoration:none;font-size:14px;font-weight:700;padding:9px 16px;border-radius:8px;">View the listing &rarr;</a>` : ''}
            ${calendarLine}
          </div>

          <div style="text-align:center;margin:20px 0;">
            <a href="${e(rsvpUrl)}" style="display:inline-block;background:${o.accent};color:${o.onAccent};text-decoration:none;font-size:15px;font-weight:700;padding:11px 22px;border-radius:10px;">Let ${e(o.agentName.split(' ')[0] || o.agentName)} know you&rsquo;re coming &rarr;</a>
          </div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border-radius:12px;">
            <tr>
              <td style="padding:14px 0 14px 16px;width:66px;vertical-align:middle;">${avatar}</td>
              <td style="padding:14px 16px 14px 12px;vertical-align:middle;">
                <div style="font-size:15px;font-weight:700;color:#1d1d1f;">${e(o.agentName)}</div>
                ${o.brokerage ? `<div style="font-size:13px;color:#6e6e73;">${e(o.brokerage)}</div>` : ''}
                <div style="font-size:13px;margin-top:3px;">${phoneBit}<a href="mailto:${e(o.agentEmail)}" style="color:${o.accent};text-decoration:none;">${e(o.agentEmail)}</a></div>
              </td>
            </tr>
          </table>

          <div style="border-top:1px solid #ececf0;margin-top:24px;padding-top:14px;font-size:11px;color:#9a9aa0;line-height:1.5;text-align:center;">
            You&rsquo;re receiving this because you signed in at one of ${e(o.agentName)}&rsquo;s open houses and agreed to hear about other properties.<br>
            <a href="${e(o.unsubscribeUrl)}" style="color:#9a9aa0;">Unsubscribe</a> &mdash; one click, and you won&rsquo;t get open-house invites again.<br>
            Powered by <span style="font-weight:300;">oh</span><b style="font-weight:700;">ACCESS</b>.com &middot; Patent Pending
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return { subject, html }
}
