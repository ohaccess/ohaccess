import { describe, it, expect } from 'vitest'
import {
  regionFor,
  configuredCountries,
  countryOptions,
  normalizeCountry,
  isNanpCountry,
  dialCodeFor,
  flagFor,
  countryFromHeaders,
  countryFromLocale,
  inferProfileCountry,
  countryOfE164,
  countryName,
  US_STATES,
  CA_PROVINCES,
} from '@/lib/regions'

describe('regionFor', () => {
  it('keeps the US exactly as the product has always read', () => {
    const us = regionFor('US')
    expect(us.country).toBe('US')
    expect(us.brokerageLabel).toBe('Brokerage')
    expect(us.licence?.numberLabel).toBe('License Number')
    expect(us.licence?.regionLabel).toBe('State')
    expect(us.licence?.regions).toBe(US_STATES)
    expect(us.address.postalLabel).toBe('ZIP Code')
    expect(us.address.includeCountryInAddress).toBe(false)
    expect(us.showNarNotice).toBe(true)
  })
  it('gives Canada provinces and the Commonwealth spelling', () => {
    const ca = regionFor('CA')
    expect(ca.brokerageLabel).toBe('Brokerage')
    expect(ca.licence?.numberLabel).toMatch(/Licence/)
    expect(ca.licence?.regions).toBe(CA_PROVINCES)
    expect(ca.address.includeCountryInAddress).toBe(false)
    expect(ca.showNarNotice).toBe(false)
  })
  it('says Agency and hides licensing for the UK', () => {
    const gb = regionFor('GB')
    expect(gb.brokerageLabel).toBe('Agency')
    expect(gb.licence).toBeNull()
    expect(gb.address.postalLabel).toBe('Postcode')
    expect(gb.address.includeCountryInAddress).toBe(true)
  })
  it('has a per-state licence dropdown for Australia and a national one for New Zealand', () => {
    expect(regionFor('AU').licence?.regions?.map(r => r.code)).toContain('NSW')
    expect(regionFor('NZ').licence?.regionLabel).toBeNull()
    expect(regionFor('NZ').licence?.regions).toBeNull()
  })
  it('falls back to a generic, optional, non-blocking config for any other country', () => {
    const jp = regionFor('JP')
    expect(jp.country).toBe('JP')
    expect(jp.brokerageLabel).toBe('Agency')
    expect(jp.licence?.optional).toBe(true)
    expect(jp.licence?.regionLabel).toBeNull()
    expect(jp.address.regionRequired).toBe(false)
    expect(jp.showNarNotice).toBe(false)
  })
  it('treats unknown / empty input as the US', () => {
    expect(regionFor(null).country).toBe('US')
    expect(regionFor('').country).toBe('US')
    expect(regionFor('ZZ').country).toBe('US')
    expect(regionFor('usa').country).toBe('US')
  })
  it('is case-insensitive', () => {
    expect(regionFor('au').country).toBe('AU')
  })
  it('every explicitly configured country resolves to a complete config', () => {
    for (const c of configuredCountries()) {
      const r = regionFor(c)
      expect(r.country).toBe(c)
      expect(r.brokerageLabel.length).toBeGreaterThan(0)
      expect(r.address.regionLabel.length).toBeGreaterThan(0)
      expect(r.address.postalLabel.length).toBeGreaterThan(0)
      expect(r.phonePlaceholder.length).toBeGreaterThan(0)
      if (r.licence) {
        expect(r.licence.numberLabel.length).toBeGreaterThan(0)
        // a dropdown list only makes sense alongside a region label
        if (r.licence.regions) expect(r.licence.regionLabel).not.toBeNull()
      }
    }
  })
})

describe('country list + codes', () => {
  it('lists every dialable country with US and Canada first', () => {
    const opts = countryOptions()
    expect(opts.length).toBeGreaterThan(200)
    expect(opts[0]).toMatchObject({ code: 'US', dialCode: '+1', name: 'United States' })
    expect(opts[1]).toMatchObject({ code: 'CA', dialCode: '+1', name: 'Canada' })
    expect(opts.find(o => o.code === 'AU')).toMatchObject({ dialCode: '+61', name: 'Australia' })
    const key = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const rest = opts.slice(2).map(o => key(o.name))
    expect(rest).toEqual([...rest].sort())
    // Accented names sort where a reader expects them, not after Z.
    const names = opts.map(o => o.name)
    expect(names.indexOf('Åland Islands')).toBeLessThan(names.indexOf('Albania'))
    expect(names.indexOf('Côte d’Ivoire')).toBeLessThan(names.indexOf('Croatia'))
    expect(names).toContain('Hong Kong')
  })
  it('normalizes ISO codes and rejects junk', () => {
    expect(normalizeCountry('au')).toBe('AU')
    expect(normalizeCountry(' GB ')).toBe('GB')
    expect(normalizeCountry('ZZ')).toBeNull()
    expect(normalizeCountry('USA')).toBeNull()
    expect(normalizeCountry('')).toBeNull()
    expect(normalizeCountry(null)).toBeNull()
  })
  it('knows the +1 family', () => {
    expect(isNanpCountry('US')).toBe(true)
    expect(isNanpCountry('CA')).toBe(true)
    expect(isNanpCountry('JM')).toBe(true)
    expect(isNanpCountry('AU')).toBe(false)
    expect(isNanpCountry(null)).toBe(false)
  })
  it('gives dial codes and flags', () => {
    expect(dialCodeFor('AU')).toBe('+61')
    expect(dialCodeFor('GB')).toBe('+44')
    expect(dialCodeFor(null)).toBe('+1')
    expect(flagFor('US')).toBe('🇺🇸')
    expect(flagFor('AU')).toBe('🇦🇺')
    expect(flagFor('nope')).toBe('🌐')
  })
  it('names countries in English', () => {
    expect(countryName('DE')).toBe('Germany')
    expect(countryName('XX')).toBe('XX')
  })
})

describe('detection', () => {
  it('reads the Vercel IP-country header', () => {
    expect(countryFromHeaders(new Headers({ 'x-vercel-ip-country': 'AU' }))).toBe('AU')
    expect(countryFromHeaders(new Headers({ 'x-vercel-ip-country': 'XX' }))).toBeNull()
    expect(countryFromHeaders(new Headers())).toBeNull()
  })
  it('reads the region out of a BCP-47 locale', () => {
    expect(countryFromLocale('en-AU')).toBe('AU')
    expect(countryFromLocale('fr-CA')).toBe('CA')
    expect(countryFromLocale('pt_BR')).toBe('BR')
    expect(countryFromLocale('zh-Hant-TW')).toBe('TW')
    expect(countryFromLocale('en')).toBeNull()
    expect(countryFromLocale('')).toBeNull()
    expect(countryFromLocale(null)).toBeNull()
  })
  it('infers a legacy profile country: explicit > Canadian province > foreign phone > US', () => {
    expect(inferProfileCountry({ country: 'AU' })).toBe('AU')
    expect(inferProfileCountry({ country: 'au', state: 'TX' })).toBe('AU')
    expect(inferProfileCountry({ state: 'ON' })).toBe('CA')
    expect(inferProfileCountry({ state: 'bc' })).toBe('CA')
    expect(inferProfileCountry({ state: 'TX' })).toBe('US')
    expect(inferProfileCountry({ phone: '+61412345678' })).toBe('AU')
    expect(inferProfileCountry({ phone: '(214) 555-0182' })).toBe('US')
    expect(inferProfileCountry({})).toBe('US')
    expect(inferProfileCountry(null)).toBe('US')
  })
  it('reads the country off an E.164 number, telling US from Canada', () => {
    expect(countryOfE164('+61412345678')).toBe('AU')
    expect(countryOfE164('+442071234567')).toBe('GB')
    expect(countryOfE164('+14165550100')).toBe('CA')
    expect(countryOfE164('+12145550182')).toBe('US')
    expect(countryOfE164('2145550182')).toBeNull()
    expect(countryOfE164('')).toBeNull()
  })
})

describe('mainCountryForCallingCode', () => {
  it('picks the main country for shared calling codes', async () => {
    const { mainCountryForCallingCode } = await import('@/lib/regions')
    expect(mainCountryForCallingCode('44')).toBe('GB')
    expect(mainCountryForCallingCode('1')).toBe('US')
    expect(mainCountryForCallingCode('61')).toBe('AU')
    expect(mainCountryForCallingCode('7')).toBe('RU')
    expect(mainCountryForCallingCode('+91')).toBe('IN')
    expect(mainCountryForCallingCode('999')).toBeNull()
    expect(mainCountryForCallingCode('')).toBeNull()
  })
})

describe('floor-area unit', () => {
  it('uses square feet where the market does and square metres everywhere else', async () => {
    const { areaUnitFor, areaLabel, areaAbbrev, formatArea, regionFor } = await import('@/lib/regions')
    for (const c of ['US', 'CA', 'GB', 'IN', 'HK', 'SG', 'AE']) expect(areaUnitFor(c), c).toBe('sqft')
    for (const c of ['AU', 'NZ', 'IE', 'ZA', 'DE', 'FR', 'MX', 'BR', 'JP', 'PH']) expect(areaUnitFor(c), c).toBe('sqm')
    expect(areaUnitFor(null)).toBe('sqft') // unknown → US default, as everywhere else
    expect(regionFor('AU').areaUnit).toBe('sqm')
    expect(regionFor('US').areaUnit).toBe('sqft')
    expect(areaLabel('sqft')).toBe('Square Footage')
    expect(areaLabel('sqm')).toBe('Square Metres')
    expect(areaAbbrev('sqft')).toBe('sq ft')
    expect(areaAbbrev('sqm')).toBe('m²')
    expect(formatArea('2,450', 'US')).toBe('2,450 sq ft')
    expect(formatArea('228', 'AU')).toBe('228 m²')
    expect(formatArea('', 'AU')).toBe('')
    expect(formatArea(null, 'US')).toBe('')
  })
})
