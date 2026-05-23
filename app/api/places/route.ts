import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/auth'

type AddressComponent = {
  long_name: string
  short_name: string
  types: string[]
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
    let state = ''
    let zip = ''
    components.forEach((c) => {
      if (c.types.includes('street_number')) streetNumber = c.long_name
      if (c.types.includes('route')) route = c.long_name
      if (c.types.includes('locality')) city = c.long_name
      if (c.types.includes('administrative_area_level_1')) state = c.short_name
      if (c.types.includes('postal_code')) zip = c.long_name
    })
    return NextResponse.json({
      street: `${streetNumber} ${route}`.trim(),
      city,
      state,
      zip
    })
  }

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input!)}&types=address&components=country:us&key=${apiKey}`
  )
  const data = await res.json()
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return NextResponse.json({ error: data.status }, { status: 500 })
  }
  return NextResponse.json({ predictions: data.predictions || [] })
}
