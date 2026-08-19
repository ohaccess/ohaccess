import { NextResponse } from 'next/server'
import { countryFromHeaders } from '@/lib/regions'

// Best guess at which country the browser is in, from Vercel's IP-geolocation
// header. Used once, by Settings, to pre-select the Country field for an
// agent who hasn't chosen one yet (the phone dial code, "Brokerage" vs
// "Agency", licence fields and address search all key off that choice). The
// agent can always change it — this is a default, never a decision.
//
// Returns { country: null } in local dev and anywhere the header is missing;
// the client then falls back to the browser locale, then to US. Display-only,
// no data touched, so no auth. Per-visitor geo makes it uncacheable.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return NextResponse.json({ country: countryFromHeaders(request.headers) })
}
