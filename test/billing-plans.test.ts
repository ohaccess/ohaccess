import { describe, it, expect } from 'vitest'
import {
  BROKERAGE_SEAT_CENTS,
  MIN_BROKERAGE_SEATS,
  MAX_BROKERAGE_SEATS,
  perSeatCents,
  totalCents,
  isValidSeatCount,
  isLegacyTwoYear,
  isExpiredLegacyTwoYear,
  TRIAL_LIMIT,
  trialLimitFor,
  isComped,
  isExpiredComp,
  isExpiredPrepaidAccess,
} from '@/lib/billing-plans'

describe('per-seat rates', () => {
  it('charges the advertised flat rates per interval', () => {
    expect(perSeatCents('month')).toBe(1_100) // $11/seat/mo
    expect(perSeatCents('year')).toBe(11_000) // $110/seat/yr
    expect(perSeatCents('two_year_prepay')).toBe(17_600) // $176/seat/2yr
  })

  it('keeps the same discount pattern as Pro/Team (derivation invariants)', () => {
    // annual = 10 months (2 free); 2-year = annual + half of a second year.
    expect(BROKERAGE_SEAT_CENTS.year).toBe(10 * BROKERAGE_SEAT_CENTS.month)
    expect(BROKERAGE_SEAT_CENTS.two_year_prepay).toBe(
      BROKERAGE_SEAT_CENTS.year + 6 * BROKERAGE_SEAT_CENTS.month
    )
  })
})

describe('isValidSeatCount', () => {
  it('accepts integers within the self-serve range (11–100)', () => {
    expect(isValidSeatCount(MIN_BROKERAGE_SEATS)).toBe(true)
    expect(isValidSeatCount(50)).toBe(true)
    expect(isValidSeatCount(MAX_BROKERAGE_SEATS)).toBe(true)
  })
  it('rejects out-of-range and non-integer input', () => {
    expect(isValidSeatCount(10)).toBe(false) // Team territory
    expect(isValidSeatCount(101)).toBe(false) // contact-us territory
    expect(isValidSeatCount(0)).toBe(false)
    expect(isValidSeatCount(-5)).toBe(false)
    expect(isValidSeatCount(11.5)).toBe(false)
    expect(isValidSeatCount('11')).toBe(false)
    expect(isValidSeatCount(NaN)).toBe(false)
    expect(isValidSeatCount(null)).toBe(false)
    expect(isValidSeatCount(undefined)).toBe(false)
  })
})

describe('totalCents', () => {
  it('is seats × rate — bill strictly increases with seats (no volume cliffs)', () => {
    expect(totalCents(11, 'month')).toBe(12_100) // $121/mo — the honest-UI number
    expect(totalCents(100, 'month')).toBe(110_000) // $1,100/mo
    expect(totalCents(11, 'year')).toBe(121_000)
    expect(totalCents(11, 'two_year_prepay')).toBe(193_600)
    // monotonic: every added seat costs more
    for (let s = MIN_BROKERAGE_SEATS; s < MAX_BROKERAGE_SEATS; s++) {
      expect(totalCents(s + 1, 'month')).toBeGreaterThan(totalCents(s, 'month'))
    }
  })
  it('throws outside the self-serve range', () => {
    expect(() => totalCents(10, 'month')).toThrow()
    expect(() => totalCents(101, 'month')).toThrow()
  })
})

describe('isLegacyTwoYear / isExpiredLegacyTwoYear', () => {
  const past = new Date(Date.now() - 86_400_000).toISOString()
  const future = new Date(Date.now() + 86_400_000).toISOString()

  it('legacy = two_year_prepay interval AND no subscription id', () => {
    expect(isLegacyTwoYear({ billing_interval: 'two_year_prepay', stripe_subscription_id: null })).toBe(true)
    expect(isLegacyTwoYear({ billing_interval: 'two_year_prepay' })).toBe(true)
  })
  it('a NEW-style 2-year subscription (has sub id) is never legacy', () => {
    expect(isLegacyTwoYear({ billing_interval: 'two_year_prepay', stripe_subscription_id: 'sub_123' })).toBe(false)
  })
  it('month/year intervals are never legacy', () => {
    expect(isLegacyTwoYear({ billing_interval: 'month', stripe_subscription_id: null })).toBe(false)
    expect(isLegacyTwoYear({ billing_interval: 'year', stripe_subscription_id: null })).toBe(false)
  })
  it('handles null/undefined profiles', () => {
    expect(isLegacyTwoYear(null)).toBe(false)
    expect(isLegacyTwoYear(undefined)).toBe(false)
  })

  it('expired = legacy AND access date in the past', () => {
    expect(isExpiredLegacyTwoYear({ billing_interval: 'two_year_prepay', stripe_subscription_id: null, current_period_end: past })).toBe(true)
    expect(isExpiredLegacyTwoYear({ billing_interval: 'two_year_prepay', stripe_subscription_id: null, current_period_end: future })).toBe(false)
    expect(isExpiredLegacyTwoYear({ billing_interval: 'two_year_prepay', stripe_subscription_id: null, current_period_end: null })).toBe(false)
  })
  it('a new-style 2-year sub is never "expired legacy", even past its period end (Stripe renews it)', () => {
    expect(isExpiredLegacyTwoYear({ billing_interval: 'two_year_prepay', stripe_subscription_id: 'sub_123', current_period_end: past })).toBe(false)
  })
})

describe('trialLimitFor (bonus visitors)', () => {
  it('is 25 with no bonus', () => {
    expect(TRIAL_LIMIT).toBe(25)
    expect(trialLimitFor(null)).toBe(25)
    expect(trialLimitFor(undefined)).toBe(25)
    expect(trialLimitFor({})).toBe(25)
    expect(trialLimitFor({ bonus_visitors: null })).toBe(25)
    expect(trialLimitFor({ bonus_visitors: 0 })).toBe(25)
  })
  it('adds admin-gifted bonus visitors', () => {
    expect(trialLimitFor({ bonus_visitors: 25 })).toBe(50)
    expect(trialLimitFor({ bonus_visitors: 1 })).toBe(26)
  })
  it('never LOWERS the cap on bad data (negative, NaN, fractional)', () => {
    expect(trialLimitFor({ bonus_visitors: -10 })).toBe(25)
    expect(trialLimitFor({ bonus_visitors: NaN })).toBe(25)
    expect(trialLimitFor({ bonus_visitors: 10.9 })).toBe(35) // floors fractions
  })
})

describe('isComped / isExpiredComp / isExpiredPrepaidAccess', () => {
  const past = new Date(Date.now() - 86_400_000).toISOString()
  const future = new Date(Date.now() + 86_400_000).toISOString()

  it('comped = billing_interval "comped" AND no subscription id', () => {
    expect(isComped({ billing_interval: 'comped', stripe_subscription_id: null })).toBe(true)
    expect(isComped({ billing_interval: 'comped' })).toBe(true)
    expect(isComped({ billing_interval: 'comped', stripe_subscription_id: 'sub_123' })).toBe(false)
    expect(isComped({ billing_interval: 'month', stripe_subscription_id: null })).toBe(false)
    expect(isComped(null)).toBe(false)
    expect(isComped(undefined)).toBe(false)
  })

  it('a comp expires when its access date passes', () => {
    expect(isExpiredComp({ billing_interval: 'comped', stripe_subscription_id: null, current_period_end: past })).toBe(true)
    expect(isExpiredComp({ billing_interval: 'comped', stripe_subscription_id: null, current_period_end: future })).toBe(false)
    expect(isExpiredComp({ billing_interval: 'comped', stripe_subscription_id: null, current_period_end: null })).toBe(false)
  })

  it('isExpiredPrepaidAccess covers both legacy 2-year AND expired comps', () => {
    expect(isExpiredPrepaidAccess({ billing_interval: 'two_year_prepay', stripe_subscription_id: null, current_period_end: past })).toBe(true)
    expect(isExpiredPrepaidAccess({ billing_interval: 'comped', stripe_subscription_id: null, current_period_end: past })).toBe(true)
    expect(isExpiredPrepaidAccess({ billing_interval: 'comped', stripe_subscription_id: null, current_period_end: future })).toBe(false)
    // a real Stripe subscription never reads as expired prepaid access
    expect(isExpiredPrepaidAccess({ billing_interval: 'month', stripe_subscription_id: 'sub_123', current_period_end: past })).toBe(false)
    expect(isExpiredPrepaidAccess(null)).toBe(false)
  })
})
