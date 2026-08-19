// Per-country product configuration — what changes when an agent (or an open
// house, or a visitor's phone) is somewhere other than the US or Canada.
//
// ohACCESS is marketed in the US and Canada, but anyone anywhere may sign up
// and use it (Dave's call, 2026-08-19). The dashboard stays English; what
// adapts by country is:
//   • terminology — "Brokerage" is a North American word; most of the world
//     says "Agency"
//   • professional licensing — which countries license agents at all, what
//     the number is called, and whether it's issued per state/province or
//     nationally (so the "State" field only appears where it means something)
//   • address labels — ZIP vs postcode, state vs province vs county
//   • phone — the dial prefix the number pickers default to
//   • the US-only NAR buyer-representation notice on the visitor form
//
// One table, one lookup: regionFor(country). Anything not listed explicitly
// gets DEFAULT_REGION — generic, optional, never blocking — so a country we
// haven't thought about still works end-to-end. Pure module (no React, no
// env) so it's safe to import from both client components and route handlers.

import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min'
import { COUNTRY_NAMES } from '@/lib/country-names'
// The raw metadata the parser above already ships — only its calling-code →
// countries map is used here (main country listed first: 44 → GB, GG, IM, JE).
import minMetadata from 'libphonenumber-js/min/metadata'

export type SubRegion = { code: string; name: string }

export type RegionConfig = {
  country: string
  // What agents in this country call the firm they hang their licence with.
  brokerageLabel: string
  brokeragePlaceholder: string
  // Professional licensing / registration of agents. null = no such scheme
  // (e.g. the UK) → the licence fields are hidden entirely.
  licence: null | {
    numberLabel: string
    numberPlaceholder: string
    // Shown with an "(optional)" hint where licensing exists but isn't
    // universal or isn't something visitors expect to see.
    optional: boolean
    // The jurisdiction the licence is issued by. null = a single national
    // scheme (no region field at all).
    regionLabel: string | null
    // A dropdown list when the set of jurisdictions is well known; null with a
    // regionLabel = free-text region field.
    regions: SubRegion[] | null
  }
  address: {
    regionLabel: string
    regionRequired: boolean
    postalLabel: string
    // Whether the stored one-line property address ends with the country
    // name ("…, NSW 2026, Australia"). US/CA addresses stay exactly as they
    // always were; everywhere else gets the country so maps links and the
    // server-side geocoder can't land on a same-named street abroad.
    includeCountryInAddress: boolean
  }
  // Example national-format mobile number for input placeholders.
  phonePlaceholder: string
  // The NAR (National Association of REALTORS®) written-buyer-agreement
  // notice is a US rule; it only makes sense on US open houses.
  showNarNotice: boolean
}

// ---- Sub-region lists -------------------------------------------------------

export const US_STATES: SubRegion[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
]

export const CA_PROVINCES: SubRegion[] = [
  { code: 'AB', name: 'Alberta' }, { code: 'BC', name: 'British Columbia' }, { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' }, { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' }, { code: 'NT', name: 'Northwest Territories' }, { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' }, { code: 'PE', name: 'Prince Edward Island' }, { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' }, { code: 'YT', name: 'Yukon' },
]

export const AU_STATES: SubRegion[] = [
  { code: 'ACT', name: 'Australian Capital Territory' }, { code: 'NSW', name: 'New South Wales' },
  { code: 'NT', name: 'Northern Territory' }, { code: 'QLD', name: 'Queensland' },
  { code: 'SA', name: 'South Australia' }, { code: 'TAS', name: 'Tasmania' },
  { code: 'VIC', name: 'Victoria' }, { code: 'WA', name: 'Western Australia' },
]

export const IN_STATES: SubRegion[] = [
  { code: 'AP', name: 'Andhra Pradesh' }, { code: 'AR', name: 'Arunachal Pradesh' }, { code: 'AS', name: 'Assam' },
  { code: 'BR', name: 'Bihar' }, { code: 'CG', name: 'Chhattisgarh' }, { code: 'GA', name: 'Goa' },
  { code: 'GJ', name: 'Gujarat' }, { code: 'HR', name: 'Haryana' }, { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'JH', name: 'Jharkhand' }, { code: 'KA', name: 'Karnataka' }, { code: 'KL', name: 'Kerala' },
  { code: 'MP', name: 'Madhya Pradesh' }, { code: 'MH', name: 'Maharashtra' }, { code: 'MN', name: 'Manipur' },
  { code: 'ML', name: 'Meghalaya' }, { code: 'MZ', name: 'Mizoram' }, { code: 'NL', name: 'Nagaland' },
  { code: 'OD', name: 'Odisha' }, { code: 'PB', name: 'Punjab' }, { code: 'RJ', name: 'Rajasthan' },
  { code: 'SK', name: 'Sikkim' }, { code: 'TN', name: 'Tamil Nadu' }, { code: 'TS', name: 'Telangana' },
  { code: 'TR', name: 'Tripura' }, { code: 'UP', name: 'Uttar Pradesh' }, { code: 'UK', name: 'Uttarakhand' },
  { code: 'WB', name: 'West Bengal' }, { code: 'AN', name: 'Andaman and Nicobar Islands' },
  { code: 'CH', name: 'Chandigarh' }, { code: 'DD', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: 'DL', name: 'Delhi' }, { code: 'JK', name: 'Jammu and Kashmir' }, { code: 'LA', name: 'Ladakh' },
  { code: 'LD', name: 'Lakshadweep' }, { code: 'PY', name: 'Puducherry' },
]

export const BR_STATES: SubRegion[] = [
  { code: 'AC', name: 'Acre' }, { code: 'AL', name: 'Alagoas' }, { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' }, { code: 'BA', name: 'Bahia' }, { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' }, { code: 'ES', name: 'Espírito Santo' }, { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' }, { code: 'MT', name: 'Mato Grosso' }, { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' }, { code: 'PA', name: 'Pará' }, { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' }, { code: 'PE', name: 'Pernambuco' }, { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' }, { code: 'RN', name: 'Rio Grande do Norte' }, { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' }, { code: 'RR', name: 'Roraima' }, { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' }, { code: 'SE', name: 'Sergipe' }, { code: 'TO', name: 'Tocantins' },
]

// ---- The table --------------------------------------------------------------

const DEFAULT_REGION: RegionConfig = {
  country: '',
  brokerageLabel: 'Agency',
  brokeragePlaceholder: 'Your agency name',
  licence: {
    numberLabel: 'Licence / Registration Number',
    numberPlaceholder: 'If your country issues one',
    optional: true,
    regionLabel: null,
    regions: null,
  },
  address: {
    regionLabel: 'State / Region',
    regionRequired: false,
    postalLabel: 'Postal Code',
    includeCountryInAddress: true,
  },
  phonePlaceholder: 'Mobile number',
  showNarNotice: false,
}

// Spelling follows the country: "License" in the US, "Licence" in the rest
// of the English-speaking world.
const REGIONS: Record<string, Partial<RegionConfig>> = {
  US: {
    brokerageLabel: 'Brokerage',
    brokeragePlaceholder: 'Premier Realty Group',
    licence: {
      numberLabel: 'License Number',
      numberPlaceholder: 'TX-123456',
      optional: false,
      regionLabel: 'State',
      regions: US_STATES,
    },
    address: { regionLabel: 'State', regionRequired: true, postalLabel: 'ZIP Code', includeCountryInAddress: false },
    phonePlaceholder: '(214) 555-0182',
    showNarNotice: true,
  },
  CA: {
    brokerageLabel: 'Brokerage',
    brokeragePlaceholder: 'Premier Realty Group',
    licence: {
      numberLabel: 'Licence / Registration Number',
      numberPlaceholder: 'Your provincial licence number',
      optional: false,
      regionLabel: 'Province / Territory',
      regions: CA_PROVINCES,
    },
    address: { regionLabel: 'Province', regionRequired: true, postalLabel: 'Postal Code', includeCountryInAddress: false },
    phonePlaceholder: '(416) 555-0182',
  },
  AU: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Harbour Property Group',
    licence: {
      numberLabel: 'Licence Number',
      numberPlaceholder: 'Your state licence or certificate number',
      optional: false,
      regionLabel: 'State / Territory',
      regions: AU_STATES,
    },
    address: { regionLabel: 'State / Territory', regionRequired: true, postalLabel: 'Postcode', includeCountryInAddress: true },
    phonePlaceholder: '0412 345 678',
  },
  NZ: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Harbour Realty',
    licence: {
      numberLabel: 'REA Licence Number',
      numberPlaceholder: 'Real Estate Authority licence number',
      optional: false,
      regionLabel: null,
      regions: null,
    },
    address: { regionLabel: 'Region', regionRequired: false, postalLabel: 'Postcode', includeCountryInAddress: true },
    phonePlaceholder: '021 123 4567',
  },
  GB: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Your estate agency',
    // Estate agents in the UK aren't licensed — there's redress-scheme
    // membership, but no number visitors would expect to see. Hide the fields.
    licence: null,
    address: { regionLabel: 'County', regionRequired: false, postalLabel: 'Postcode', includeCountryInAddress: true },
    phonePlaceholder: '07700 900123',
  },
  IE: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Your estate agency',
    licence: {
      numberLabel: 'PSRA Licence Number',
      numberPlaceholder: 'Property Services Regulatory Authority licence',
      optional: false,
      regionLabel: null,
      regions: null,
    },
    address: { regionLabel: 'County', regionRequired: false, postalLabel: 'Eircode', includeCountryInAddress: true },
    phonePlaceholder: '085 123 4567',
  },
  ZA: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Your agency name',
    licence: {
      numberLabel: 'FFC Number',
      numberPlaceholder: 'PPRA Fidelity Fund Certificate number',
      optional: false,
      regionLabel: null,
      regions: null,
    },
    address: { regionLabel: 'Province', regionRequired: false, postalLabel: 'Postal Code', includeCountryInAddress: true },
    phonePlaceholder: '082 123 4567',
  },
  IN: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Your agency name',
    licence: {
      numberLabel: 'RERA Registration Number',
      numberPlaceholder: 'Your state RERA agent registration',
      optional: false,
      regionLabel: 'State / UT',
      regions: IN_STATES,
    },
    address: { regionLabel: 'State', regionRequired: true, postalLabel: 'PIN Code', includeCountryInAddress: true },
    phonePlaceholder: '98765 43210',
  },
  SG: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Your estate agency',
    licence: {
      numberLabel: 'CEA Registration Number',
      numberPlaceholder: 'Council for Estate Agencies registration',
      optional: false,
      regionLabel: null,
      regions: null,
    },
    address: { regionLabel: 'District', regionRequired: false, postalLabel: 'Postal Code', includeCountryInAddress: true },
    phonePlaceholder: '8123 4567',
  },
  HK: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Your estate agency',
    licence: {
      numberLabel: 'EAA Licence Number',
      numberPlaceholder: 'Estate Agents Authority licence',
      optional: false,
      regionLabel: null,
      regions: null,
    },
    address: { regionLabel: 'District', regionRequired: false, postalLabel: 'Postal Code', includeCountryInAddress: true },
    phonePlaceholder: '5123 4567',
  },
  AE: {
    brokerageLabel: 'Brokerage',
    brokeragePlaceholder: 'Your brokerage name',
    licence: {
      numberLabel: 'Broker Registration Number (BRN)',
      numberPlaceholder: 'RERA / DLD broker number',
      optional: false,
      regionLabel: null,
      regions: null,
    },
    address: { regionLabel: 'Emirate', regionRequired: false, postalLabel: 'Postal Code', includeCountryInAddress: true },
    phonePlaceholder: '050 123 4567',
  },
  PH: {
    brokerageLabel: 'Brokerage',
    brokeragePlaceholder: 'Your brokerage name',
    licence: {
      numberLabel: 'PRC License Number',
      numberPlaceholder: 'Professional Regulation Commission licence',
      optional: false,
      regionLabel: null,
      regions: null,
    },
    address: { regionLabel: 'Province', regionRequired: false, postalLabel: 'ZIP Code', includeCountryInAddress: true },
    phonePlaceholder: '0917 123 4567',
  },
  MX: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Your inmobiliaria',
    licence: {
      numberLabel: 'Licence / Registration Number',
      numberPlaceholder: 'State registry number, where required',
      optional: true,
      regionLabel: 'State',
      regions: null,
    },
    address: { regionLabel: 'State', regionRequired: false, postalLabel: 'Postal Code', includeCountryInAddress: true },
    phonePlaceholder: '55 1234 5678',
  },
  BR: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Your imobiliária',
    licence: {
      numberLabel: 'CRECI Number',
      numberPlaceholder: 'Your CRECI registration',
      optional: false,
      regionLabel: 'State',
      regions: BR_STATES,
    },
    address: { regionLabel: 'State', regionRequired: true, postalLabel: 'CEP', includeCountryInAddress: true },
    phonePlaceholder: '11 91234-5678',
  },
  PT: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Your agency name',
    licence: {
      numberLabel: 'AMI Licence Number',
      numberPlaceholder: 'IMPIC / AMI licence',
      optional: false,
      regionLabel: null,
      regions: null,
    },
    address: { regionLabel: 'District', regionRequired: false, postalLabel: 'Postal Code', includeCountryInAddress: true },
    phonePlaceholder: '912 345 678',
  },
  FR: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Your agency name',
    licence: {
      numberLabel: 'Carte Professionnelle Number',
      numberPlaceholder: 'CPI number',
      optional: false,
      regionLabel: null,
      regions: null,
    },
    address: { regionLabel: 'Region', regionRequired: false, postalLabel: 'Postal Code', includeCountryInAddress: true },
    phonePlaceholder: '06 12 34 56 78',
  },
  IT: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Your agency name',
    licence: {
      numberLabel: 'REA Registration Number',
      numberPlaceholder: 'Chamber of Commerce registration',
      optional: false,
      regionLabel: null,
      regions: null,
    },
    address: { regionLabel: 'Province', regionRequired: false, postalLabel: 'Postal Code', includeCountryInAddress: true },
    phonePlaceholder: '312 345 6789',
  },
  ES: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Your agency name',
    licence: {
      numberLabel: 'Registration Number',
      numberPlaceholder: 'Regional API / agent registry, where required',
      optional: true,
      regionLabel: null,
      regions: null,
    },
    address: { regionLabel: 'Province', regionRequired: false, postalLabel: 'Postal Code', includeCountryInAddress: true },
    phonePlaceholder: '612 34 56 78',
  },
  DE: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Your agency name',
    licence: {
      numberLabel: 'Registration Number',
      numberPlaceholder: '§34c permit / trade registration',
      optional: true,
      regionLabel: null,
      regions: null,
    },
    address: { regionLabel: 'State', regionRequired: false, postalLabel: 'Postal Code', includeCountryInAddress: true },
    phonePlaceholder: '0151 23456789',
  },
  NL: {
    brokerageLabel: 'Agency',
    brokeragePlaceholder: 'Your agency name',
    licence: {
      numberLabel: 'Registration Number',
      numberPlaceholder: 'KvK or NVM number (optional)',
      optional: true,
      regionLabel: null,
      regions: null,
    },
    address: { regionLabel: 'Province', regionRequired: false, postalLabel: 'Postcode', includeCountryInAddress: true },
    phonePlaceholder: '06 12345678',
  },
}

// ---- Country list -----------------------------------------------------------

export type CountryOption = { code: string; name: string; dialCode: string }

let countryCache: CountryOption[] | null = null

// English display name for an ISO code. A fixed table first (identical on
// server and client — see lib/country-names.ts), then the runtime's Intl data
// for anything newer than the table, then the code itself.
//
// To regenerate the table after a libphonenumber upgrade adds a country:
//   node -e "const lp=require('libphonenumber-js/min');const dn=new Intl.DisplayNames(['en'],{type:'region'});
//     for(const c of lp.getCountries().sort()) console.log(c+': '+JSON.stringify(dn.of(c))+',')"
export function countryName(code: string): string {
  const fixed = COUNTRY_NAMES[code.toUpperCase()]
  if (fixed) return fixed
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code)
    if (name && name !== code) return name
  } catch {
    // older runtime without Intl.DisplayNames — fall through
  }
  return code
}

// Every country libphonenumber knows a dial code for, sorted by English name
// (accents stripped for ordering, plain code-point compare — NOT localeCompare,
// whose collation tables also differ between runtimes), with US and Canada
// pinned to the top (the vast majority of our agents). Computed once per
// process.
export function countryOptions(): CountryOption[] {
  if (countryCache) return countryCache
  const all: CountryOption[] = getCountries().map(code => ({
    code: code as string,
    name: countryName(code),
    dialCode: `+${getCountryCallingCode(code)}`,
  }))
  const pinned = ['US', 'CA']
  const top: CountryOption[] = []
  for (const c of pinned) {
    const found = all.find(o => o.code === c)
    if (found) top.push(found)
  }
  const sortKey = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const rest = all
    .filter(o => !pinned.includes(o.code))
    .sort((a, b) => {
      const ka = sortKey(a.name)
      const kb = sortKey(b.name)
      return ka < kb ? -1 : ka > kb ? 1 : 0
    })
  const list: CountryOption[] = [...top, ...rest]
  countryCache = list
  return list
}

// Uppercase ISO 3166-1 alpha-2, or null if it isn't a country we can dial.
export function normalizeCountry(input: string | null | undefined): string | null {
  const code = (input || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return null
  return getCountries().includes(code as CountryCode) ? code : null
}

export function isCountry(input: string | null | undefined): boolean {
  return normalizeCountry(input) !== null
}

// US, Canada and the Caribbean NANP members all share +1 and the
// "(512) 555-1234" shape our legacy rows are stored in.
export function isNanpCountry(country: string | null | undefined): boolean {
  const code = normalizeCountry(country)
  if (!code) return false
  return getCountryCallingCode(code as CountryCode) === '1'
}

export function dialCodeFor(country: string | null | undefined): string {
  const code = normalizeCountry(country) ?? 'US'
  return `+${getCountryCallingCode(code as CountryCode)}`
}

// The "main" country for a calling code — GB for +44, US for +1, AU for +61,
// RU for +7 — for a number too partial to be placed by area code yet.
export function mainCountryForCallingCode(callingCode: string | null | undefined): string | null {
  const cc = (callingCode || '').replace(/\D/g, '')
  if (!cc) return null
  const map = (minMetadata as { country_calling_codes: Record<string, string[]> }).country_calling_codes
  const list = map[cc]
  return list && list.length > 0 ? list[0] : null
}

// Regional flag emoji from the ISO code (two regional-indicator symbols).
export function flagFor(country: string | null | undefined): string {
  const code = normalizeCountry(country)
  if (!code) return '🌐'
  return String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
}

// ---- Lookup -----------------------------------------------------------------

export function regionFor(country: string | null | undefined): RegionConfig {
  const code = normalizeCountry(country) ?? 'US'
  const overrides = REGIONS[code] ?? {}
  return { ...DEFAULT_REGION, ...overrides, country: code }
}

// The countries with an explicit entry above (useful for tests and docs).
export function configuredCountries(): string[] {
  return Object.keys(REGIONS)
}

// ---- Detection --------------------------------------------------------------

// Vercel stamps every request with the visitor's IP-derived country. Absent
// in local dev and behind some proxies → null, never a guess.
export function countryFromHeaders(headers: { get(name: string): string | null }): string | null {
  return normalizeCountry(headers.get('x-vercel-ip-country'))
}

// "en-AU" / "fr-CA" / "pt-BR" → the region part. A bare "en" has none.
export function countryFromLocale(locale: string | null | undefined): string | null {
  const m = /[-_]([A-Za-z]{2})(?:[-_]|$)/.exec(locale || '')
  return m ? normalizeCountry(m[1]) : null
}

// Which country an existing profile belongs to when profiles.country is
// still null (every account created before 2026-08-19). Canada is inferred
// from a Canadian province in the licence-state field; a non-+1 phone stored
// in E.164 gives its country away; otherwise US — where every pre-existing
// agent actually is.
export function inferProfileCountry(profile: {
  country?: string | null
  state?: string | null
  phone?: string | null
} | null | undefined): string {
  const explicit = normalizeCountry(profile?.country)
  if (explicit) return explicit
  const state = (profile?.state || '').trim().toUpperCase()
  if (state && CA_PROVINCES.some(p => p.code === state)) return 'CA'
  const phone = (profile?.phone || '').trim()
  if (phone.startsWith('+') && !phone.startsWith('+1')) {
    const fromPhone = countryOfE164(phone)
    if (fromPhone) return fromPhone
  }
  return 'US'
}

// Country of an E.164 number ("+61412345678" → "AU", "+14165550100" → "CA"),
// or null when it can't be determined. Shared dial codes (+1, +7, +44 …) are
// resolved by the parser from the area code, so US and Canada come apart.
export function countryOfE164(e164: string | null | undefined): string | null {
  if (!e164 || !e164.trim().startsWith('+')) return null
  const parsed = parsePhoneNumberFromString(e164.trim())
  return parsed?.country ?? null
}
