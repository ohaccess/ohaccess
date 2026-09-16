import { STATE_METRO, isLatLng, type LatLng } from './sun'

// Where an agent works, for the weekend-games email. Two things depend on
// it: sunrise/sunset, and which of the state's games is "theirs" (a Houston
// agent's Texans over the Cowboys). Best source first:
//
//   open_house   their most recent open house with map coordinates
//   area_code    their mobile number's area code, for the big metros below
//   metro        the state's largest metro (a guess, so the email doesn't
//                label anything "Your market" from it)

export type LocationSource = 'open_house' | 'area_code' | 'metro'
export type AgentLocation = { at: LatLng; source: LocationSource }

// A team whose home is this close is the agent's own market.
export const LOCAL_MILES = 60
// Within this, still a regional team (a Waco agent and the Cowboys).
export const NEARBY_MILES = 150
export const LOCAL_BOOST = 30
export const NEARBY_BOOST = 10

// Area code → metro, for the largest US markets. An agent's number in one
// of these is a strong hint of where they work; anything else falls back to
// the state metro. Coordinates are the metro's center.
const METROS: [LatLng, string[]][] = [
  [{ lat: 40.71, lng: -74.01 }, ['212', '646', '332', '917', '718', '347', '929', '516', '631', '914', '201', '551', '973', '862', '732', '848', '908']], // New York + North Jersey
  [{ lat: 34.05, lng: -118.24 }, ['213', '323', '310', '424', '818', '747', '626', '562', '714', '657', '949', '909', '951']], // Los Angeles
  [{ lat: 41.88, lng: -87.63 }, ['312', '773', '872', '708', '847', '224', '630', '331', '815', '779']], // Chicago
  [{ lat: 32.78, lng: -96.8 }, ['214', '469', '972', '945', '817', '682']], // Dallas / Fort Worth
  [{ lat: 29.76, lng: -95.37 }, ['713', '832', '281', '346']], // Houston
  [{ lat: 29.42, lng: -98.49 }, ['210', '726']], // San Antonio
  [{ lat: 30.27, lng: -97.74 }, ['512', '737']], // Austin
  [{ lat: 31.76, lng: -106.49 }, ['915']], // El Paso
  [{ lat: 31.55, lng: -97.15 }, ['254']], // Waco / Killeen
  [{ lat: 33.58, lng: -101.86 }, ['806']], // Lubbock / Amarillo
  [{ lat: 27.8, lng: -97.4 }, ['361']], // Corpus Christi
  [{ lat: 26.2, lng: -98.23 }, ['956']], // McAllen / Rio Grande Valley
  [{ lat: 30.08, lng: -94.1 }, ['409']], // Beaumont / Galveston
  [{ lat: 32.35, lng: -95.3 }, ['903']], // Tyler / East Texas
  [{ lat: 31.99, lng: -102.08 }, ['432']], // Midland / Odessa
  [{ lat: 38.9, lng: -77.04 }, ['202', '771', '703', '571', '301', '240']], // Washington, DC
  [{ lat: 25.76, lng: -80.19 }, ['305', '786', '954', '754', '561']], // Miami / Fort Lauderdale / West Palm
  [{ lat: 27.95, lng: -82.46 }, ['813', '656', '727']], // Tampa / St. Petersburg
  [{ lat: 28.54, lng: -81.38 }, ['407', '689', '321']], // Orlando
  [{ lat: 30.33, lng: -81.66 }, ['904']], // Jacksonville
  [{ lat: 39.95, lng: -75.17 }, ['215', '267', '445', '610', '484']], // Philadelphia
  [{ lat: 40.44, lng: -79.99 }, ['412', '878']], // Pittsburgh
  [{ lat: 33.75, lng: -84.39 }, ['404', '470', '678', '770']], // Atlanta
  [{ lat: 42.36, lng: -71.06 }, ['617', '857', '781', '339', '508', '774', '978', '351']], // Boston
  [{ lat: 33.45, lng: -112.07 }, ['602', '480', '623']], // Phoenix
  [{ lat: 37.77, lng: -122.42 }, ['415', '628', '510', '341', '650', '925']], // San Francisco / East Bay
  [{ lat: 37.34, lng: -121.89 }, ['408', '669']], // San Jose
  [{ lat: 38.58, lng: -121.49 }, ['916', '279']], // Sacramento
  [{ lat: 32.72, lng: -117.16 }, ['619', '858']], // San Diego
  [{ lat: 47.61, lng: -122.33 }, ['206', '253', '425', '564']], // Seattle
  [{ lat: 45.52, lng: -122.68 }, ['503', '971']], // Portland
  [{ lat: 39.74, lng: -104.99 }, ['303', '720', '983']], // Denver
  [{ lat: 40.76, lng: -111.89 }, ['801', '385']], // Salt Lake City
  [{ lat: 36.17, lng: -115.14 }, ['702', '725']], // Las Vegas
  [{ lat: 42.33, lng: -83.05 }, ['313', '248', '586', '734', '947']], // Detroit
  [{ lat: 44.98, lng: -93.27 }, ['612', '651', '763', '952']], // Minneapolis / St. Paul
  [{ lat: 43.04, lng: -87.91 }, ['414']], // Milwaukee
  [{ lat: 44.51, lng: -88.01 }, ['920']], // Green Bay
  [{ lat: 41.5, lng: -81.69 }, ['216', '440']], // Cleveland
  [{ lat: 39.1, lng: -84.51 }, ['513']], // Cincinnati
  [{ lat: 39.96, lng: -83.0 }, ['614', '380']], // Columbus
  [{ lat: 39.77, lng: -86.16 }, ['317', '463']], // Indianapolis
  [{ lat: 39.1, lng: -94.58 }, ['816', '913']], // Kansas City
  [{ lat: 38.63, lng: -90.2 }, ['314', '636']], // St. Louis
  [{ lat: 39.29, lng: -76.61 }, ['410', '443', '667']], // Baltimore
  [{ lat: 35.23, lng: -80.84 }, ['704', '980']], // Charlotte
  [{ lat: 35.78, lng: -78.64 }, ['919', '984']], // Raleigh
  [{ lat: 36.16, lng: -86.78 }, ['615', '629']], // Nashville
  [{ lat: 35.15, lng: -90.05 }, ['901']], // Memphis
  [{ lat: 38.25, lng: -85.76 }, ['502']], // Louisville
  [{ lat: 29.95, lng: -90.07 }, ['504']], // New Orleans
  [{ lat: 35.47, lng: -97.52 }, ['405']], // Oklahoma City
  [{ lat: 42.89, lng: -78.88 }, ['716']], // Buffalo
  [{ lat: 33.52, lng: -86.81 }, ['205', '659']], // Birmingham
  [{ lat: 21.31, lng: -157.86 }, ['808']], // Honolulu
]

const AREA_CODE_METRO = new Map<string, LatLng>()
for (const [at, codes] of METROS) for (const code of codes) AREA_CODE_METRO.set(code, at)

// The metro an E.164 US number's area code points to, or null.
export function locationFromPhone(phone: string | null | undefined): LatLng | null {
  const digits = String(phone ?? '').replace(/\D/g, '')
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits.length === 10 ? digits : null
  if (!national) return null
  return AREA_CODE_METRO.get(national.slice(0, 3)) ?? null
}

export function resolveAgentLocation(o: {
  state: string
  openHouse?: { lat?: unknown; lng?: unknown } | null
  phone?: string | null
}): AgentLocation {
  if (isLatLng(o.openHouse)) return { at: { lat: o.openHouse.lat, lng: o.openHouse.lng }, source: 'open_house' }
  const fromPhone = locationFromPhone(o.phone)
  if (fromPhone) return { at: fromPhone, source: 'area_code' }
  return { at: STATE_METRO[o.state] ?? { lat: 39.83, lng: -98.58 }, source: 'metro' }
}

const EARTH_MILES = 3958.8
const RAD = Math.PI / 180

export function distanceMiles(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD
  const dLng = (b.lng - a.lng) * RAD
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_MILES * Math.asin(Math.sqrt(h))
}

// How much closer-to-home counts when picking the "Big one".
export function marketBoost(miles: number | null): number {
  if (miles === null) return 0
  if (miles <= LOCAL_MILES) return LOCAL_BOOST
  if (miles <= NEARBY_MILES) return NEARBY_BOOST
  return 0
}
