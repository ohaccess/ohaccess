// Which lifecycle ("drip") email, if any, an agent should receive today.
// Pure decision logic — no I/O — so every rule is unit-testable; the daily
// /api/cron/drip job gathers the inputs and does the sending. Schedule
// approved by Dave 2026-09-05:
//
//   day 2   finish_setup     signed up, never logged in (one nudge, ever)
//   day 5   first_open_house logged in, no open house yet
//   day 12  referral         held/created an open house — share-your-link
//   day 21  hardware_offer   free-tier — 2-year plan + free sign hardware
//   day 30+ checkin_1..3     no open-house activity in 30 days, monthly,
//                            three lifetime — then we go quiet for good
//
// Global guardrails, in order of precedence: opted-out agents get nothing;
// nobody gets more than one drip email per NO_DRIP_WITHIN_MS window; an
// agent who does the thing (logs in, creates an open house) automatically
// falls out of the matching segment because the segment is computed from
// live state, not from a queue.

export const DAY_MS = 24 * 60 * 60_000

// Minimum spacing between any two drip emails to the same agent.
export const NO_DRIP_WITHIN_MS = 7 * DAY_MS

export const FINISH_SETUP_AFTER_MS = 2 * DAY_MS
// Never-logged-in addresses are unverified, so the nudge only goes to fresh
// signups — mailing months-old unconfirmed addresses is how sender
// reputations die.
export const FINISH_SETUP_CEILING_MS = 30 * DAY_MS
export const FIRST_OPEN_HOUSE_AFTER_MS = 5 * DAY_MS
export const REFERRAL_AFTER_MS = 12 * DAY_MS
export const HARDWARE_OFFER_AFTER_MS = 21 * DAY_MS
export const CHECKIN_AFTER_MS = 30 * DAY_MS
// "Inactive" = no open house created or scheduled inside this window.
export const CHECKIN_INACTIVITY_MS = 30 * DAY_MS
// Spacing between check-ins (the 7-day global rule also applies).
export const CHECKIN_GAP_MS = 30 * DAY_MS

export const CHECKIN_KEYS = ['checkin_1', 'checkin_2', 'checkin_3'] as const

export const DRIP_EMAIL_KEYS = [
  'finish_setup',
  'first_open_house',
  'referral',
  'hardware_offer',
  ...CHECKIN_KEYS,
] as const

export type DripEmailKey = (typeof DRIP_EMAIL_KEYS)[number]

export type DripAgentState = {
  createdAt: string // auth user created_at — the signup moment
  lastSignInAt: string | null
  optedOut: boolean
  hasEmail: boolean
  // Paid tier that hasn't lapsed, or covered by a paying sponsor — either way
  // the 2-year upsell doesn't apply.
  paidAccess: boolean
  hardwareOfferActive: boolean
  hasHardwareClaim: boolean
  openHouseCount: number
  // max(created_at, start_at) across the agent's open houses — the most
  // recent sign the account is in use.
  lastOpenHouseActivityAt: string | null
  hasUpcomingOpenHouse: boolean
  // email_key -> sent_at for every drip email already sent to this agent.
  sent: Partial<Record<DripEmailKey, string>>
}

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : ms
}

export function decideDripEmail(s: DripAgentState, now: Date): DripEmailKey | null {
  if (!s.hasEmail || s.optedOut) return null

  const nowMs = now.getTime()
  const createdMs = parseMs(s.createdAt)
  if (createdMs === null) return null
  const age = nowMs - createdMs

  const sentTimes = Object.values(s.sent)
    .map((iso) => parseMs(iso))
    .filter((ms): ms is number => ms !== null)
  if (sentTimes.length && nowMs - Math.max(...sentTimes) < NO_DRIP_WITHIN_MS) {
    return null
  }

  // Never logged in: exactly one nudge, then silence — everything else in the
  // sequence presumes a real, active account.
  if (!s.lastSignInAt) {
    if (
      !s.sent.finish_setup &&
      age >= FINISH_SETUP_AFTER_MS &&
      age <= FINISH_SETUP_CEILING_MS
    ) {
      return 'finish_setup'
    }
    return null
  }

  if (
    s.openHouseCount === 0 &&
    !s.sent.first_open_house &&
    age >= FIRST_OPEN_HOUSE_AFTER_MS
  ) {
    return 'first_open_house'
  }

  // Referral goes to agents who've actually used the product — an ask to
  // recommend us lands hollow before their first open house.
  if (s.openHouseCount > 0 && !s.sent.referral && age >= REFERRAL_AFTER_MS) {
    return 'referral'
  }

  if (
    s.hardwareOfferActive &&
    !s.paidAccess &&
    !s.hasHardwareClaim &&
    !s.sent.hardware_offer &&
    age >= HARDWARE_OFFER_AFTER_MS
  ) {
    return 'hardware_offer'
  }

  if (age < CHECKIN_AFTER_MS) return null
  if (s.hasUpcomingOpenHouse) return null
  const lastActivityMs = parseMs(s.lastOpenHouseActivityAt)
  if (lastActivityMs !== null && nowMs - lastActivityMs < CHECKIN_INACTIVITY_MS) {
    return null
  }
  const sentCheckins = CHECKIN_KEYS.filter((k) => s.sent[k])
  if (sentCheckins.length >= CHECKIN_KEYS.length) return null
  const lastCheckinTimes = sentCheckins
    .map((k) => parseMs(s.sent[k]))
    .filter((ms): ms is number => ms !== null)
  if (
    lastCheckinTimes.length &&
    nowMs - Math.max(...lastCheckinTimes) < CHECKIN_GAP_MS
  ) {
    return null
  }
  return CHECKIN_KEYS[sentCheckins.length]
}
