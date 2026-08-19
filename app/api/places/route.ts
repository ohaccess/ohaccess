import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/auth'
import { normalizeCountry } from '@/lib/regions'

type AddressComponent = {
  long_name: string
  short_name: string
  types: string[]
}

// Which countries the address search looks in. Google's autocomplete wants
// a restriction (unrestricted "123 Main" returns noise from five continents),
// so we restrict to the AGENT's country — their listings are there. US and
// Canadian agents keep the original US+Canada pair (border markets, and the
// behaviour every existing agent has today). Anyone else gets their own
// country. Unknown/missing → the US+Canada default.
function countryFilter(country: string | null): string {
  if (!country || country === 'US' || country === 'CA') return 'country:us|country:ca'
  return `country:${country.toLowerCase()}`
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ip = getClientIp(request)
  const limit = await checkRateLimit(`ip:${ip}`, 'places', 120, 3600)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const input = searchParams.get('input')
  const placeId = searchParams.get('placeId')
  const country = normalizeCountry(searchParams.get('country'))

  if (!input && !placeId) {
    return NextResponse.json({ error: 'Missing input or placeId' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY

  if (placeId) {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeId)}&key=${apiKey}`
    )
    const data = await res.json()
    if (data.status !== 'OK') {
      return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 })
    }
    const components: AddressComponent[] = data.results[0].address_components
    let streetNumber = ''
    let route = ''
    let city = ''
    let postalTown = ''
    let sublocality = ''
    let adminArea2 = ''
    let state = ''
    let zip = ''
    let placeCountry = ''
    components.forEach((c) => {
      if (c.types.includes('street_number')) streetNumber = c.long_name
      if (c.types.includes('route')) route = c.long_name
      if (c.types.includes('locality')) city = c.long_name
      // What Google calls the town varies by country: the UK mostly uses
      // postal_town, parts of Asia and Latin America use sublocality, and a
      // few places only carry a level-2 admin area. Prefer locality, then
      // the fallbacks in that order.
      if (c.types.includes('postal_town')) postalTown = c.long_name
      if (c.types.includes('sublocality_level_1') || c.types.includes('sublocality')) sublocality = sublocality || c.long_name
      if (c.types.includes('administrative_area_level_2')) adminArea2 = c.long_name
      // short_name gives TX / ON / NSW where a country uses codes and the
      // full name ("England", "Bavaria") where it doesn't — both fine.
      if (c.types.includes('administrative_area_level_1')) state = c.short_name
      if (c.types.includes('postal_code')) zip = c.long_name
      if (c.types.includes('country')) placeCountry = c.short_name
    })
    city = city || postalTown || sublocality || adminArea2

    // Resolve the property's timezone from its coordinates so open-house times
    // are anchored to the property, not whoever is scheduling. Requires the
    // "Time Zone API" to be enabled on the Google key; on any failure we just
    // omit it and the client falls back to the scheduler's device timezone.
    let timezone: string | null = null
    const loc = data.results[0].geometry?.location
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      try {
        const tzRes = await fetch(
          `https://maps.googleapis.com/maps/api/timezone/json?location=${loc.lat},${loc.lng}&timestamp=${Math.floor(Date.now() / 1000)}&key=${apiKey}`
        )
        const tzData = await tzRes.json()
        if (tzData.status === 'OK' && tzData.timeZoneId) timezone = tzData.timeZoneId
      } catch {
        // ignore — client falls back to device timezone
      }
    }

    return NextResponse.json({
      street: `${streetNumber} ${route}`.trim(),
      city,
      state,
      zip,
      country: normalizeCountry(placeCountry),
      timezone,
    })
  }

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input!)}&types=address&components=${encodeURIComponent(countryFilter(country))}&key=${apiKey}`
  )
  const data = await res.json()
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return NextResponse.json({ error: data.status }, { status: 500 })
  }
  return NextResponse.json({ predictions: data.predictions || [] })
}
