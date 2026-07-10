import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'

// GET: every open house in the system with map coordinates, a past/current/
// future status, and agent contact info, for the admin Map tab. Addresses are
// geocoded server-side (same Google key the address autocomplete uses) and
// cached in-memory per lambda so repeat loads don't re-bill; an address that
// fails to geocode is reported in `unmapped` instead of silently vanishing
// from the map.

type PinAgent = { id: string; name: string; phone: string; email: string }
export type PinStatus = 'past' | 'current' | 'future'
export type MapPin = {
  id: string
  address: string
  date: string
  hours: string
  listingUrl: string | null
  status: PinStatus
  lat: number
  lng: number
  agent: PinAgent
}

const geoCache = new Map<string, { lat: number; lng: number } | null>()

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (geoCache.has(address)) return geoCache.get(address) ?? null
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_SERVER_KEY}`
    )
    const data = await res.json()
    const loc = data.status === 'OK' ? data.results[0]?.geometry?.location : null
    const coords = loc && typeof loc.lat === 'number' && typeof loc.lng === 'number'
      ? { lat: loc.lat, lng: loc.lng }
      : null
    geoCache.set(address, coords)
    return coords
  } catch {
    // Transient failure — don't cache, so the next load retries.
    return null
  }
}

// Where does this open house sit relative to now? Structured start_at/end_at
// when present; legacy rows fall back to the free-text date (counted as
// "current" for its whole day, matching how /r/[code] treats day precision).
function pinStatus(
  oh: { start_at: string | null; end_at: string | null; open_house_date: string | null },
  now: number
): PinStatus {
  const start = oh.start_at ? Date.parse(oh.start_at) : NaN
  const end = oh.end_at ? Date.parse(oh.end_at) : NaN
  if (!Number.isNaN(start)) {
    if (now < start) return 'future'
    if (!Number.isNaN(end) && now <= end) return 'current'
    return 'past'
  }
  const day = oh.open_house_date ? Date.parse(oh.open_house_date) : NaN
  if (!Number.isNaN(day)) {
    if (now < day) return 'future'
    if (now <= day + 24 * 60 * 60 * 1000) return 'current'
  }
  return 'past'
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: rows, error } = await supabase
    .from('open_houses')
    .select('id, property_address, open_house_date, open_house_hours, listing_url, start_at, end_at, agent_id, profiles(id, full_name, display_email, email, phone)')
    .order('start_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to load open houses' }, { status: 500 })
  }

  const now = Date.now()
  const pins: MapPin[] = []
  const unmapped: string[] = []

  await Promise.all(
    (rows || []).map(async (oh) => {
      const address = oh.property_address || ''
      const coords = address ? await geocode(address) : null
      // supabase-js types a to-one join as an array; runtime gives the object.
      const profile = (Array.isArray(oh.profiles) ? oh.profiles[0] : oh.profiles) as {
        id: string; full_name: string | null; display_email: string | null; email: string | null; phone: string | null
      } | null
      const item = {
        id: oh.id,
        address,
        date: oh.open_house_date || '',
        hours: oh.open_house_hours || '',
        listingUrl: /^https?:\/\//i.test(oh.listing_url || '') ? oh.listing_url : null,
        status: pinStatus(oh, now),
        agent: {
          id: profile?.id || oh.agent_id || '',
          name: profile?.full_name || 'Unknown agent',
          phone: profile?.phone || '',
          email: profile?.display_email || profile?.email || '',
        },
      }
      if (coords) {
        pins.push({ ...item, ...coords })
      } else {
        unmapped.push(address || `(no address) ${oh.id}`)
      }
    })
  )

  // Promise.all scrambles order — restore soonest-first for the pin list.
  pins.sort((a, b) => (rows || []).findIndex(r => r.id === a.id) - (rows || []).findIndex(r => r.id === b.id))

  return NextResponse.json({ pins, unmapped, generatedAt: new Date().toISOString() })
}
