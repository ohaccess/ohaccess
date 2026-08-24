// Free sign-hardware offer: the first 100 individual Pro 2-year subscribers
// in each state choose two pedestal sign stands or one A-frame, shipped free.
//
// Pure config + logic only (no I/O) so the phase rules are unit-testable.
// Counts come from the hardware_claims table via the admin client in
// /api/hardware-offer (marketing display), /api/stripe/checkout (eligibility),
// and the Stripe webhook (recording).

// Flip to false to retire the offer everywhere at once: the pricing-page box
// disappears and checkout stops attaching the shipping/choice fields.
// Existing claims are unaffected.
export const HARDWARE_OFFER_ACTIVE = true

// Per-state cap. The binding state is the SHIPPING address at checkout.
export const STATE_LIMIT = 100

// The advertised copy changes phase on live counts — every phase states only
// true facts, leading with whichever true fact persuades best at that moment:
//   generic   → no numbers ("first 100 agents in each state"); high remaining
//               counts read as "nobody wants this", so don't show them.
//   claimed   → social proof ("31 Ohio agents have claimed theirs").
//   remaining → real scarcity ("Only 14 left in Ohio") — the only phase where
//               urgency copy is truthful, per the FTC deceptive-claims rules.
//   exhausted → state is full; show nothing and collect nothing at checkout.
export const SCARCITY_THRESHOLD = 25 // remaining ≤ this → 'remaining' phase
export const SOCIAL_PROOF_THRESHOLD = 25 // claimed ≥ this → 'claimed' phase

export type OfferPhase = 'generic' | 'claimed' | 'remaining' | 'exhausted'

export function offerPhase(claimed: number): OfferPhase {
  const remaining = STATE_LIMIT - claimed
  if (remaining <= 0) return 'exhausted'
  if (remaining <= SCARCITY_THRESHOLD) return 'remaining'
  if (claimed >= SOCIAL_PROOF_THRESHOLD) return 'claimed'
  return 'generic'
}

// Stripe custom-field dropdown values → labels (also shown at checkout).
export const HARDWARE_CHOICES = {
  pedestal_pair: 'Two pedestal sign stands',
  a_frame: 'One A-frame sign frame',
} as const

export type HardwareChoice = keyof typeof HARDWARE_CHOICES

export function isHardwareChoice(value: unknown): value is HardwareChoice {
  return value === 'pedestal_pair' || value === 'a_frame'
}

// Stripe rejects dropdown option values containing anything but letters and
// digits (no underscores), so checkout sends these and the webhook maps them
// back to the HardwareChoice names the hardware_claims table requires.
export const STRIPE_HARDWARE_VALUES: Record<HardwareChoice, string> = {
  pedestal_pair: 'pedestalpair',
  a_frame: 'aframe',
}

export function hardwareChoiceFromStripe(raw: unknown): HardwareChoice | null {
  if (isHardwareChoice(raw)) return raw
  const match = (Object.keys(STRIPE_HARDWARE_VALUES) as HardwareChoice[]).find(
    (choice) => STRIPE_HARDWARE_VALUES[choice] === raw
  )
  return match ?? null
}

// 2-letter codes → display names. DC included (it has agents too); the offer
// copy says "state" but the cap applies per code, which is what the shipping
// address yields.
export const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'Washington, DC',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

// Normalize whatever a shipping address carries in its state field to a
// 2-letter code: "OH" and "ohio" both → "OH". Returns null when it isn't a
// US state (foreign order shapes, typos) — the caller decides what to do.
export function normalizeStateCode(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  const upper = value.toUpperCase()
  if (US_STATES[upper]) return upper
  const byName = Object.entries(US_STATES).find(
    ([, name]) => name.toUpperCase() === upper
  )
  return byName ? byName[0] : null
}
