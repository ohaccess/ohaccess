import Stripe from 'stripe'

// Lazy init: Next.js evaluates route modules during build-time page-data
// collection where env vars aren't injected. Throwing at module load would
// fail the build; instead we defer until the first actual call.
let _stripe: Stripe | null = null

function init(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment')
  }
  return new Stripe(secretKey, {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
  })
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) _stripe = init()
    const value = Reflect.get(_stripe, prop, _stripe)
    return typeof value === 'function' ? value.bind(_stripe) : value
  },
})

export type Tier = 'pro' | 'team' | 'brokerage'
export type BillingInterval = 'month' | 'year' | 'two_year_prepay'

// Every plan is a real Stripe subscription now — including the 2-year term
// (interval: year × 2, auto-renews) and the per-seat Brokerage tier (the
// subscription's quantity carries the seat count). The old one-time-payment
// 2-year flow is gone; legacy holders are handled via lib/billing-plans.
interface PriceConfig {
  envVar: string
  mode: 'subscription'
}

const PRICE_CONFIG: Record<Tier, Record<BillingInterval, PriceConfig>> = {
  pro: {
    month:           { envVar: 'STRIPE_PRICE_PRO_MONTHLY', mode: 'subscription' },
    year:            { envVar: 'STRIPE_PRICE_PRO_ANNUAL',  mode: 'subscription' },
    two_year_prepay: { envVar: 'STRIPE_PRICE_PRO_2YEAR',   mode: 'subscription' },
  },
  team: {
    month:           { envVar: 'STRIPE_PRICE_TEAM_MONTHLY', mode: 'subscription' },
    year:            { envVar: 'STRIPE_PRICE_TEAM_ANNUAL',  mode: 'subscription' },
    two_year_prepay: { envVar: 'STRIPE_PRICE_TEAM_2YEAR',   mode: 'subscription' },
  },
  // Per-seat prices ($11 / $110 / $176 per seat) — checkout passes the seat
  // count as the line-item quantity (self-serve range 11–100, enforced in
  // lib/billing-plans; 100+ deals are negotiated and admin-provisioned).
  brokerage: {
    month:           { envVar: 'STRIPE_PRICE_BROKERAGE_MONTHLY', mode: 'subscription' },
    year:            { envVar: 'STRIPE_PRICE_BROKERAGE_ANNUAL',  mode: 'subscription' },
    two_year_prepay: { envVar: 'STRIPE_PRICE_BROKERAGE_2YEAR',   mode: 'subscription' },
  },
}

export function isTier(value: unknown): value is Tier {
  return value === 'pro' || value === 'team' || value === 'brokerage'
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === 'month' || value === 'year' || value === 'two_year_prepay'
}

export function getPriceConfig(tier: Tier, interval: BillingInterval): PriceConfig & { priceId: string } {
  const cfg = PRICE_CONFIG[tier][interval]
  const priceId = process.env[cfg.envVar]
  if (!priceId) {
    throw new Error(`Missing env var ${cfg.envVar} for ${tier}/${interval}`)
  }
  return { ...cfg, priceId }
}
