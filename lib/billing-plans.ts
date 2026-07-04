import type { BillingInterval } from './stripe'

// Pure pricing/plan logic for the per-seat Brokerage tier and the legacy
// 2-year-prepay grandfathering rule. Deliberately free of stripe/supabase
// imports (the type-only import above is erased at compile time) so it can be
// used from client components and unit-tested in isolation.
//
// Public plan lineup (Dave's decision, 2026-07-03):
//   Pro     — 1 agent            (flat prices, unchanged)
//   Team    — 2–10 agents        (flat $120/mo, unchanged)
//   Brokerage — 11–100 agents    (flat $11/agent/mo — THIS module)
//   100+ agents                  ("Contact us" — negotiated, admin-provisioned)
//
// There are deliberately NO volume bands in code: a flat public per-seat rate
// means the bill is strictly increasing in seats, which eliminates the
// band-crossing gaming problem (e.g. 1,001 agents costing less than 1,000).

export const MIN_BROKERAGE_SEATS = 11
export const MAX_BROKERAGE_SEATS = 100

// Cents per seat per billing term. Derivation matches the Pro/Team discount
// pattern (unit-tested as an invariant):
//   year     = 10 × month          (annual = 2 months free)
//   two_year = year + 6 × month    (year 1 at annual rate + year 2 half off)
export const BROKERAGE_SEAT_CENTS: Record<BillingInterval, number> = {
  month: 1_100,            // $11/seat/mo
  year: 11_000,            // $110/seat/yr
  two_year_prepay: 17_600, // $176/seat per 2-year term
}

export function perSeatCents(interval: BillingInterval): number {
  return BROKERAGE_SEAT_CENTS[interval]
}

// Integer seat count within the self-serve range. Anything above
// MAX_BROKERAGE_SEATS is a negotiated deal (contact us / admin-provisioned).
export function isValidSeatCount(n: unknown): n is number {
  return (
    typeof n === 'number' &&
    Number.isInteger(n) &&
    n >= MIN_BROKERAGE_SEATS &&
    n <= MAX_BROKERAGE_SEATS
  )
}

export function totalCents(seats: number, interval: BillingInterval): number {
  if (!isValidSeatCount(seats)) {
    throw new Error(`Seat count must be an integer ${MIN_BROKERAGE_SEATS}–${MAX_BROKERAGE_SEATS}, got ${seats}`)
  }
  return seats * perSeatCents(interval)
}

// ---------------------------------------------------------------------------
// Legacy 2-year prepay (grandfathering)
// ---------------------------------------------------------------------------
// Before 2026-07, the 2-year term was sold as a ONE-TIME payment: no Stripe
// subscription, access granted via a locally computed current_period_end.
// New 2-year purchases are real auto-renewing subscriptions (same
// billing_interval key, but they carry a stripe_subscription_id).
//
// A profile is a LEGACY holder iff it has the 2-year interval AND no
// subscription id. This single definition is shared by every guard so it
// cannot drift between files.

interface LegacyCheckFields {
  billing_interval?: string | null
  stripe_subscription_id?: string | null
}

export function isLegacyTwoYear(p: LegacyCheckFields | null | undefined): boolean {
  return !!p && p.billing_interval === 'two_year_prepay' && !p.stripe_subscription_id
}

// A legacy prepay whose access date has passed reads tier=paid/status=active
// forever (nothing at Stripe ever ends it), so callers must treat it as free:
// the dashboard shows the renewal prompt, the register route applies the trial
// cap, and checkout allows a new purchase.
export function isExpiredLegacyTwoYear(
  p: (LegacyCheckFields & { current_period_end?: string | null }) | null | undefined
): boolean {
  return (
    isLegacyTwoYear(p) &&
    !!p?.current_period_end &&
    Date.parse(p.current_period_end) < Date.now()
  )
}
