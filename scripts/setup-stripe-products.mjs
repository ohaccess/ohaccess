// One-shot setup: creates Pro products + prices in your Stripe account.
// Idempotent — looks up existing prices by lookup_key before creating.
//
// Usage:
//   1. Make sure STRIPE_SECRET_KEY is set in .env.local (test key starts with sk_test_)
//   2. From the repo root: node scripts/setup-stripe-products.mjs
//
// At the end, prints the STRIPE_PRICE_* env vars to add to .env.local.

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import Stripe from 'stripe'

// Load .env.local if present (no dotenv dep).
const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const secret = process.env.STRIPE_SECRET_KEY
if (!secret) {
  console.error('Missing STRIPE_SECRET_KEY. Add it to .env.local first.')
  process.exit(1)
}
if (!secret.startsWith('sk_test_') && !process.argv.includes('--live')) {
  console.error('STRIPE_SECRET_KEY does not look like a test key. Refusing to run.')
  console.error('Pass --live to run against live Stripe (NOT recommended for setup).')
  process.exit(1)
}

const stripe = new Stripe(secret, { apiVersion: '2026-04-22.dahlia' })

// ---- Product + price definitions ------------------------------------------

const PRODUCTS = [
  {
    productName: 'ohACCESS Pro',
    description: 'Unlimited open houses, unlimited visitor registrations, agent SMS alerts.',
    prices: [
      { lookup_key: 'ohaccess_pro_monthly', envVar: 'STRIPE_PRICE_PRO_MONTHLY',
        unit_amount: 1500, recurring: { interval: 'month' },
        nickname: 'Pro Monthly' },
      { lookup_key: 'ohaccess_pro_annual', envVar: 'STRIPE_PRICE_PRO_ANNUAL',
        unit_amount: 15000, recurring: { interval: 'year' },
        nickname: 'Pro Annual (2 months free)' },
      { lookup_key: 'ohaccess_pro_2year', envVar: 'STRIPE_PRICE_PRO_2YEAR',
        unit_amount: 24000, recurring: { interval: 'year', interval_count: 2 },
        nickname: 'Pro 2-Year ($150 year 1 + $90 year 2 half off — renews every 2 years)' },
    ],
  },
  {
    productName: 'ohACCESS Team',
    description: 'Up to 10 agents, brand customization, team logo. Includes all Pro features.',
    prices: [
      { lookup_key: 'ohaccess_team_monthly', envVar: 'STRIPE_PRICE_TEAM_MONTHLY',
        unit_amount: 12000, recurring: { interval: 'month' },
        nickname: 'Team Monthly' },
      { lookup_key: 'ohaccess_team_annual', envVar: 'STRIPE_PRICE_TEAM_ANNUAL',
        unit_amount: 120000, recurring: { interval: 'year' },
        nickname: 'Team Annual (2 months free)' },
      { lookup_key: 'ohaccess_team_2year', envVar: 'STRIPE_PRICE_TEAM_2YEAR',
        unit_amount: 192000, recurring: { interval: 'year', interval_count: 2 },
        nickname: 'Team 2-Year ($1,200 year 1 + $720 year 2 half off — renews every 2 years)' },
    ],
  },
  {
    // Per-seat plan for 11–100 agents. These are PER-SEAT unit prices — the
    // checkout line item's QUANTITY carries the seat count, so Stripe handles
    // seat-add proration natively. Amounts must match lib/billing-plans.ts
    // (BROKERAGE_SEAT_CENTS): month $11, year $110 (10×), 2-year $176 (year + 6×month).
    productName: 'ohACCESS Brokerage',
    description: 'Per-agent pricing for 11–100 agents. Brand customization, team logo, all Pro features.',
    prices: [
      { lookup_key: 'ohaccess_brokerage_monthly', envVar: 'STRIPE_PRICE_BROKERAGE_MONTHLY',
        unit_amount: 1100, recurring: { interval: 'month' },
        nickname: 'Brokerage Monthly ($11/agent/mo)' },
      { lookup_key: 'ohaccess_brokerage_annual', envVar: 'STRIPE_PRICE_BROKERAGE_ANNUAL',
        unit_amount: 11000, recurring: { interval: 'year' },
        nickname: 'Brokerage Annual ($110/agent/yr — 2 months free)' },
      { lookup_key: 'ohaccess_brokerage_2year', envVar: 'STRIPE_PRICE_BROKERAGE_2YEAR',
        unit_amount: 17600, recurring: { interval: 'year', interval_count: 2 },
        nickname: 'Brokerage 2-Year ($176/agent — year 2 half off, renews every 2 years)' },
    ],
  },
]

// ---- Helpers --------------------------------------------------------------

async function getOrCreateProduct(name, description) {
  const existing = await stripe.products.search({ query: `name:"${name}"` })
  if (existing.data.length > 0) {
    console.log(`Reusing product: ${name} (${existing.data[0].id})`)
    return existing.data[0]
  }
  const created = await stripe.products.create({ name, description })
  console.log(`Created product:  ${name} (${created.id})`)
  return created
}

// A price only "matches" if BOTH the amount AND the billing shape agree.
// Comparing unit_amount alone is a trap: converting the 2-year plans from
// one-time payments to recurring subscriptions keeps the SAME amount but
// changes `recurring` — without this check the script would silently reuse
// the old one-time price and checkout would keep selling the wrong thing.
function priceMatches(old, { unit_amount, recurring }) {
  if (old.unit_amount !== unit_amount) return false
  if (!old.recurring !== !recurring) return false // one-time vs recurring
  if (old.recurring && recurring) {
    if (old.recurring.interval !== recurring.interval) return false
    if ((old.recurring.interval_count ?? 1) !== (recurring.interval_count ?? 1)) return false
  }
  return true
}

function describePrice({ unit_amount, recurring }) {
  return recurring
    ? `${unit_amount}¢ every ${recurring.interval_count ?? 1} ${recurring.interval}(s)`
    : `${unit_amount}¢ one-time`
}

async function getOrCreatePrice(productId, { lookup_key, unit_amount, recurring, nickname }) {
  const existing = await stripe.prices.list({ lookup_keys: [lookup_key], limit: 1 })
  if (existing.data.length > 0) {
    const old = existing.data[0]
    // Same amount AND same billing shape → reuse as-is.
    if (priceMatches(old, { unit_amount, recurring })) {
      console.log(`Reusing price:    ${lookup_key} (${old.id})`)
      return old
    }
    // Stripe prices are IMMUTABLE — neither the amount nor the recurrence can
    // be edited. When the definition changes, create a new price, move the
    // lookup_key onto it (transfer_lookup_key), and archive the old price so
    // it's no longer offered. The printed env var will point to the NEW price
    // id — update .env.local with it.
    console.log(`Definition changed for ${lookup_key}: ${describePrice(old)} → ${describePrice({ unit_amount, recurring })} — creating a new price.`)
    const replacement = await stripe.prices.create({
      product: productId,
      currency: 'usd',
      unit_amount,
      ...(recurring ? { recurring } : {}),
      lookup_key,
      nickname,
      transfer_lookup_key: true,
    })
    try {
      await stripe.prices.update(old.id, { active: false })
    } catch (e) {
      // The new price exists and now owns the lookup_key, but the old one is
      // still ACTIVE — if its id is still in .env.local, checkout keeps charging
      // the OLD amount. Fail loudly so the operator archives it by hand instead
      // of silently shipping the wrong price.
      throw new Error(
        `Created new price ${replacement.id} for "${lookup_key}" but FAILED to archive the old price ${old.id} (${e.message}). ` +
        `The OLD price is still ACTIVE — archive it in the Stripe dashboard, then set the ${lookup_key} env var to ${replacement.id}.`
      )
    }
    console.log(`Created price:    ${lookup_key} (${replacement.id}) — archived old ${old.id}`)
    console.log(`  ⚠️  ACTION REQUIRED: update .env.local so its ${lookup_key} env var = ${replacement.id} (else checkout keeps using the old price).`)
    return replacement
  }
  const created = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount,
    ...(recurring ? { recurring } : {}),
    lookup_key,
    nickname,
    transfer_lookup_key: true,
  })
  console.log(`Created price:    ${lookup_key} (${created.id})`)
  return created
}

// ---- Run ------------------------------------------------------------------

const envOutput = []

for (const { productName, description, prices } of PRODUCTS) {
  const product = await getOrCreateProduct(productName, description)
  for (const p of prices) {
    const price = await getOrCreatePrice(product.id, p)
    envOutput.push(`${p.envVar}=${price.id}`)
  }
}

console.log('\n----- Add these to .env.local -----\n')
console.log(envOutput.join('\n'))
console.log('\n-----------------------------------\n')
console.log('Done. Next step: configure the webhook endpoint in Stripe and copy the')
console.log('signing secret into STRIPE_WEBHOOK_SECRET.')
