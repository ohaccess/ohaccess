import { zonedParts } from './time'

// Sunrise and sunset for the weekend-games email, computed locally with the
// NOAA solar-position formulas (no service to call, accurate to about a
// minute). The email needs a location: the agent's latest open house when
// we have its map coordinates, otherwise their state's largest metro.

export type LatLng = { lat: number; lng: number }

// Largest metro area per state (and DC). Sunset differs by 10 to 15 minutes
// across the biggest states, so this is close for nearly everyone; an
// agent's own open-house coordinates beat it when available.
export const STATE_METRO: Record<string, LatLng> = {
  AL: { lat: 33.52, lng: -86.81 }, // Birmingham
  AK: { lat: 61.22, lng: -149.9 }, // Anchorage
  AZ: { lat: 33.45, lng: -112.07 }, // Phoenix
  AR: { lat: 34.75, lng: -92.29 }, // Little Rock
  CA: { lat: 34.05, lng: -118.24 }, // Los Angeles
  CO: { lat: 39.74, lng: -104.99 }, // Denver
  CT: { lat: 41.31, lng: -72.92 }, // New Haven
  DE: { lat: 39.74, lng: -75.55 }, // Wilmington
  DC: { lat: 38.9, lng: -77.04 },
  FL: { lat: 25.76, lng: -80.19 }, // Miami
  GA: { lat: 33.75, lng: -84.39 }, // Atlanta
  HI: { lat: 21.31, lng: -157.86 }, // Honolulu
  ID: { lat: 43.62, lng: -116.2 }, // Boise
  IL: { lat: 41.88, lng: -87.63 }, // Chicago
  IN: { lat: 39.77, lng: -86.16 }, // Indianapolis
  IA: { lat: 41.59, lng: -93.62 }, // Des Moines
  KS: { lat: 37.69, lng: -97.34 }, // Wichita
  KY: { lat: 38.25, lng: -85.76 }, // Louisville
  LA: { lat: 29.95, lng: -90.07 }, // New Orleans
  ME: { lat: 43.66, lng: -70.26 }, // Portland
  MD: { lat: 39.29, lng: -76.61 }, // Baltimore
  MA: { lat: 42.36, lng: -71.06 }, // Boston
  MI: { lat: 42.33, lng: -83.05 }, // Detroit
  MN: { lat: 44.98, lng: -93.27 }, // Minneapolis
  MS: { lat: 32.3, lng: -90.18 }, // Jackson
  MO: { lat: 39.1, lng: -94.58 }, // Kansas City
  MT: { lat: 45.78, lng: -108.5 }, // Billings
  NE: { lat: 41.26, lng: -95.94 }, // Omaha
  NV: { lat: 36.17, lng: -115.14 }, // Las Vegas
  NH: { lat: 42.99, lng: -71.46 }, // Manchester
  NJ: { lat: 40.74, lng: -74.17 }, // Newark
  NM: { lat: 35.08, lng: -106.65 }, // Albuquerque
  NY: { lat: 40.71, lng: -74.01 }, // New York
  NC: { lat: 35.23, lng: -80.84 }, // Charlotte
  ND: { lat: 46.88, lng: -96.79 }, // Fargo
  OH: { lat: 39.96, lng: -83.0 }, // Columbus
  OK: { lat: 35.47, lng: -97.52 }, // Oklahoma City
  OR: { lat: 45.52, lng: -122.68 }, // Portland
  PA: { lat: 39.95, lng: -75.17 }, // Philadelphia
  RI: { lat: 41.82, lng: -71.41 }, // Providence
  SC: { lat: 34.0, lng: -81.03 }, // Columbia
  SD: { lat: 43.55, lng: -96.73 }, // Sioux Falls
  TN: { lat: 36.16, lng: -86.78 }, // Nashville
  TX: { lat: 32.78, lng: -96.8 }, // Dallas
  UT: { lat: 40.76, lng: -111.89 }, // Salt Lake City
  VT: { lat: 44.48, lng: -73.21 }, // Burlington
  VA: { lat: 36.85, lng: -75.98 }, // Virginia Beach
  WA: { lat: 47.61, lng: -122.33 }, // Seattle
  WV: { lat: 38.35, lng: -81.63 }, // Charleston
  WI: { lat: 43.04, lng: -87.91 }, // Milwaukee
  WY: { lat: 41.14, lng: -104.82 }, // Cheyenne
}

export function isLatLng(o: { lat?: unknown; lng?: unknown } | null | undefined): o is LatLng {
  return (
    typeof o?.lat === 'number' && typeof o?.lng === 'number' &&
    Number.isFinite(o.lat) && Number.isFinite(o.lng) &&
    Math.abs(o.lat) <= 90 && Math.abs(o.lng) <= 180
  )
}

const RAD = Math.PI / 180

// Minutes after local midnight of sunrise and sunset on a calendar date
// (NOAA's method, as in its solar calculator). Null for polar day or night.
export function sunTimes(ymd: string, at: LatLng, timeZone: string): { sunrise: number; sunset: number } | null {
  const [y, m, d] = ymd.split('-').map(Number)
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12))
  // Local offset from UTC on this date, so the answer lands in wall-clock time.
  const local = zonedParts(noonUtc, timeZone)
  const offsetMin = local.hour * 60 + local.minute - 12 * 60 + (local.ymd < ymd ? -1440 : local.ymd > ymd ? 1440 : 0)

  // Days since J2000.0 at local noon.
  const jd = noonUtc.getTime() / 86_400_000 + 2440587.5 - offsetMin / 1440
  const t = (jd - 2451545) / 36525
  const meanLong = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360
  const meanAnom = 357.52911 + t * (35999.05029 - 0.0001537 * t)
  const ecc = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
  const center =
    Math.sin(meanAnom * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * meanAnom * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * meanAnom * RAD) * 0.000289
  const trueLong = meanLong + center
  const omega = 125.04 - 1934.136 * t
  const apparentLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD)
  const obliq = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
  const obliqCorr = obliq + 0.00256 * Math.cos(omega * RAD)
  const declination = Math.asin(Math.sin(obliqCorr * RAD) * Math.sin(apparentLong * RAD))
  const yv = Math.tan((obliqCorr / 2) * RAD) ** 2
  const eqTime =
    4 *
    (yv * Math.sin(2 * meanLong * RAD) -
      2 * ecc * Math.sin(meanAnom * RAD) +
      4 * ecc * yv * Math.sin(meanAnom * RAD) * Math.cos(2 * meanLong * RAD) -
      0.5 * yv * yv * Math.sin(4 * meanLong * RAD) -
      1.25 * ecc * ecc * Math.sin(2 * meanAnom * RAD)) /
    RAD

  // Sun 0.833° below the horizon: the edge of the disc, refraction included.
  const cosHa =
    Math.cos(90.833 * RAD) / (Math.cos(at.lat * RAD) * Math.cos(declination)) -
    Math.tan(at.lat * RAD) * Math.tan(declination)
  if (cosHa < -1 || cosHa > 1) return null
  const ha = Math.acos(cosHa) / RAD
  const solarNoon = 720 - 4 * at.lng - eqTime + offsetMin
  return { sunrise: Math.round(solarNoon - 4 * ha), sunset: Math.round(solarNoon + 4 * ha) }
}
