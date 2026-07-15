// Pure logic for the 1-year Pro gift ("Know a real estate agent? Give them a
// year of ohACCESS Pro"). A gift is bought by ANYONE — no account — as a
// one-time Stripe payment (never a subscription, so the giver is never
// auto-billed again). Payment mints a claim code; the recipient redeems it at
// /gift/claim. Deliberately free of stripe/supabase imports so it can be used
// from client components and unit-tested in isolation (billing-plans pattern).

// One product only (Dave's call, 2026-07): 1 year of Pro. No monthly gifts,
// no other tiers.
export const GIFT_MONTHS = 12

// Codes get typed by humans off a printed card or read over the phone, so the
// alphabet drops the lookalikes (0/O, 1/I/L). 30^8 ≈ 6.5e11 combinations —
// unguessable behind the claim route's rate limit.
export const GIFT_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const GROUP = 4
const RAW_LENGTH = GROUP * 2

export function generateGiftCode(): string {
  let raw = ''
  for (let i = 0; i < RAW_LENGTH; i++) {
    raw += GIFT_CODE_ALPHABET.charAt(Math.floor(Math.random() * GIFT_CODE_ALPHABET.length))
  }
  return `GIFT-${raw.slice(0, GROUP)}-${raw.slice(GROUP)}`
}

// Accept every human variation — lowercase, missing or extra dashes/spaces,
// with or without the GIFT prefix — and return the canonical GIFT-XXXX-XXXX,
// or null if it can't be a gift code. (The alphabet excludes I, so a raw code
// can never itself start with "GIFT" — stripping the prefix is unambiguous.)
export function normalizeGiftCode(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const stripped = input.toUpperCase().replace(/[\s-]/g, '').replace(/^GIFT/, '')
  if (stripped.length !== RAW_LENGTH) return null
  for (const ch of stripped) {
    if (!GIFT_CODE_ALPHABET.includes(ch)) return null
  }
  return `GIFT-${stripped.slice(0, GROUP)}-${stripped.slice(GROUP)}`
}

// Where the recipient's access ends after claiming: one calendar year past
// the LATER of now and their current paid-through date, so a gift always adds
// a full 12 months on top of whatever they already have — nobody's gift ever
// evaporates into time they'd already paid for.
export function giftAccessEnd(currentPeriodEnd: string | null | undefined, now: Date = new Date()): Date {
  const currentMs = currentPeriodEnd ? Date.parse(currentPeriodEnd) : NaN
  const base = Number.isFinite(currentMs) && currentMs > now.getTime() ? new Date(currentMs) : now
  const end = new Date(base)
  end.setUTCFullYear(end.getUTCFullYear() + 1)
  return end
}
