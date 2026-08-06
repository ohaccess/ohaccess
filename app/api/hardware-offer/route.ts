import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import {
  HARDWARE_OFFER_ACTIVE,
  STATE_LIMIT,
  US_STATES,
  offerPhase,
} from '@/lib/hardware-offer'

// Live status of the free sign-hardware offer for the visitor's state, used
// by the pricing page (homepage + dashboard plan picker) to render the
// three-phase offer copy. The state comes from Vercel's IP-geolocation header
// — display only; the BINDING state for the per-state cap is the shipping
// address collected at checkout (terms §4.9).
//
// Per-visitor geo makes this uncacheable; the count query is a single
// indexed HEAD count, cheap enough to run per pageview.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!HARDWARE_OFFER_ACTIVE) {
    return NextResponse.json({ active: false })
  }

  const country = request.headers.get('x-vercel-ip-country')
  const region = (request.headers.get('x-vercel-ip-country-region') ?? '').toUpperCase()
  const state = country === 'US' && US_STATES[region] ? region : null

  // Outside the US (or geo unknown): advertise the generic phase — numbers
  // for someone else's state would be meaningless.
  if (!state) {
    return NextResponse.json({ active: true, state: null, stateName: null, phase: 'generic' })
  }

  const { count, error } = await supabase
    .from('hardware_claims')
    .select('*', { count: 'exact', head: true })
    .eq('state', state)
  // count === null with no error is what PostgREST returns when the table is
  // missing (HEAD requests get a silent 204) — treat both cases as "count
  // unknown" and fall back to the phase that makes no numeric claims.
  if (error || count === null) {
    console.error('hardware-offer count unavailable', { state, error })
    return NextResponse.json({ active: true, state: null, stateName: null, phase: 'generic' })
  }

  const claimed = count
  const phase = offerPhase(claimed)
  return NextResponse.json({
    active: phase !== 'exhausted',
    state,
    stateName: US_STATES[state],
    claimed,
    remaining: Math.max(0, STATE_LIMIT - claimed),
    phase,
  })
}
