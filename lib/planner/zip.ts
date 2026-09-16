import { normalizeStateCode } from '../hardware-offer'
import type { LatLng } from '../weekend-games/sun'

// A ZIP code typed into the planner → where it is. The route geocodes it
// with Google (server key); this file holds the pure parts so they can be
// tested without the network.

export type ZipPlace = { zip: string; state: string; city: string | null; at: LatLng }

export function normalizeZip(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').trim().slice(0, 5)
  return /^\d{5}$/.test(digits) ? digits : null
}

// Google Geocoding response for `components=postal_code:NNNNN|country:US`
// → ZipPlace, or null when it isn't a real US ZIP.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseZipGeocode(zip: string, json: any): ZipPlace | null {
  const result = json?.status === 'OK' ? json.results?.[0] : null
  if (!result) return null
  const components: { long_name?: string; short_name?: string; types?: string[] }[] = Array.isArray(result.address_components)
    ? result.address_components
    : []
  const has = (type: string) => components.find((c) => c.types?.includes(type))
  const postal = has('postal_code')?.long_name
  // Google answers a made-up ZIP with the nearest thing it can find; only a
  // result that is that ZIP counts.
  if (postal !== zip) return null
  const state = normalizeStateCode(has('administrative_area_level_1')?.short_name)
  const loc = result.geometry?.location
  if (!state || typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') return null
  const city = has('locality')?.long_name ?? has('sublocality')?.long_name ?? has('postal_town')?.long_name ?? null
  return { zip, state, city: city ? String(city) : null, at: { lat: loc.lat, lng: loc.lng } }
}
