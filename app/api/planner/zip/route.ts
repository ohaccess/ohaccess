import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { normalizeZip, parseZipGeocode, type ZipPlace } from '@/lib/planner/zip'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public, no auth: a US ZIP code → its state, city and coordinates, so the
// planner can pick the visitor's own market and sun times. Google
// Geocoding behind a per-IP rate limit and a long CDN cache (ZIPs don't
// move), so a busy day costs cents, not dollars.
const cache = new Map<string, ZipPlace | null>()

export async function GET(request: Request) {
  const zip = normalizeZip(new URL(request.url).searchParams.get('zip'))
  if (!zip) return NextResponse.json({ error: 'Enter a 5-digit US ZIP code' }, { status: 400 })

  if (!cache.has(zip)) {
    const limit = await checkRateLimit(`ip:${getClientIp(request)}`, 'planner-zip', 60, 3600)
    if (!limit.allowed) return NextResponse.json({ error: 'Too many lookups, try again in an hour' }, { status: 429 })

    const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY
    if (!apiKey) return NextResponse.json({ error: 'ZIP lookup is not set up' }, { status: 503 })
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?components=postal_code:${zip}|country:US&key=${apiKey}`,
        { signal: AbortSignal.timeout(8_000) }
      )
      const json = await res.json()
      if (json?.status && !['OK', 'ZERO_RESULTS'].includes(json.status)) throw new Error(json.status)
      cache.set(zip, parseZipGeocode(zip, json))
    } catch (e) {
      console.error('planner zip: geocode failed', zip, e)
      return NextResponse.json({ error: 'ZIP lookup failed, try again' }, { status: 502 })
    }
  }

  const place = cache.get(zip)
  if (!place) return NextResponse.json({ error: `${zip} isn't a US ZIP code we recognize` }, { status: 404 })
  return NextResponse.json(place, {
    headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400' },
  })
}
