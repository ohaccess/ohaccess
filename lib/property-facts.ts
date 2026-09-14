// Auto-fill for the New Open House form: listing price, beds, baths and size
// for a US address, from RentCast (licensed listing + public-record data).
// Pure helpers — the RentCast calls live in /api/property-facts.

// RentCast bills per lookup. We're on Foundation ($74/month for 1,000, then
// $0.06 each); Growth ($199 for 5,000) is cheaper past ~3,080 lookups, which
// at 1–2 lookups per open house is roughly this many open houses in 30 days.
// The admin dashboard says so when we cross it.
export const RENTCAST_UPGRADE_AT_OPEN_HOUSES_PER_MONTH = 2000

export type PropertyFacts = {
  listing_price: string
  bedrooms: string
  bathrooms: string
  square_footage: string
}

type RentCastRecord = {
  status?: string | null
  price?: number | null
  listedDate?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  squareFootage?: number | null
}

const positive = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null

// The newest ACTIVE for-sale listing, or null. Inactive listings are skipped
// on purpose: on listing day RentCast often still has the home's previous,
// expired listing — with an old price.
export function pickActiveListing(listings: unknown): RentCastRecord | null {
  if (!Array.isArray(listings)) return null
  const active = (listings as RentCastRecord[]).filter(
    (l) => l && l.status === 'Active' && positive(l.price) !== null
  )
  active.sort((a, b) => (b.listedDate || '').localeCompare(a.listedDate || ''))
  return active[0] ?? null
}

// Form-ready strings. Price only ever comes from an active listing; a public
// record (no listing yet) fills beds, baths and size. Baths stay in MLS
// full/half style: 3 full + 1 half = "3.5".
export function factsFrom(source: RentCastRecord, isActiveListing: boolean): PropertyFacts {
  const price = isActiveListing ? positive(source.price) : null
  const beds = positive(source.bedrooms)
  const baths = positive(source.bathrooms)
  const sqft = positive(source.squareFootage)
  return {
    listing_price: price ? `$${Math.round(price).toLocaleString('en-US')}` : '',
    bedrooms: beds ? String(beds) : '',
    bathrooms: baths ? String(baths) : '',
    square_footage: sqft ? Math.round(sqft).toLocaleString('en-US') : '',
  }
}

// Only the boxes the agent left empty — never overwrite what they typed.
export function fillEmptyFacts(form: Record<string, unknown>, facts: PropertyFacts): Partial<PropertyFacts> {
  const out: Partial<PropertyFacts> = {}
  for (const key of Object.keys(facts) as (keyof PropertyFacts)[]) {
    if (facts[key] && !String(form[key] ?? '').trim()) out[key] = facts[key]
  }
  return out
}
