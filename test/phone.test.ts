import { describe, it, expect } from 'vitest'
import {
  normalizePhone,
  usPhoneError,
  isPossibleUsPhone,
  phoneMatchVariants,
  phoneError,
  isPossiblePhone,
  formatPhoneDisplay,
  phoneCountry,
  formatNationalAsYouType,
  formatNanpAsYouType,
  storablePhone,
  splitStoredPhone,
} from '@/lib/phone'

describe('normalizePhone', () => {
  it('normalizes a formatted 10-digit number to E.164', () => {
    expect(normalizePhone('(415) 867-5309')).toBe('+14158675309')
  })
  it('accepts an already-E.164 number unchanged', () => {
    expect(normalizePhone('+14158675309')).toBe('+14158675309')
  })
  it('adds +1 to a bare 10-digit number', () => {
    expect(normalizePhone('4158675309')).toBe('+14158675309')
  })
  it('handles an 11-digit number with a leading country code', () => {
    expect(normalizePhone('14158675309')).toBe('+14158675309')
  })
  it('passes through a longer international number that starts with +', () => {
    expect(normalizePhone('+442071234567')).toBe('+442071234567')
  })
  it('returns null for too few digits or empty input', () => {
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
  })
})

describe('usPhoneError', () => {
  it('accepts a structurally valid number (with or without country code)', () => {
    expect(usPhoneError('4158675309')).toBeNull()
    expect(usPhoneError('14158675309')).toBeNull()
    expect(usPhoneError('(415) 867-5309')).toBeNull()
  })
  it('rejects too few / too many digits', () => {
    expect(usPhoneError('12345')).toMatch(/10-digit/)
    expect(usPhoneError('123456789012')).toMatch(/too many/)
  })
  it('rejects an area code starting with 0 or 1', () => {
    expect(usPhoneError('0158675309')).toMatch(/area code/)
    expect(usPhoneError('1238675309')).toMatch(/area code/)
  })
  it('rejects an exchange starting with 0 or 1', () => {
    expect(usPhoneError('4150558675')).not.toBeNull()
  })
  it('rejects N11 service codes in area code or exchange', () => {
    expect(usPhoneError('2115550100')).not.toBeNull() // 211 area
    expect(usPhoneError('4159115309')).not.toBeNull() // 911 exchange
  })
  it('rejects the 555-01xx fictional range', () => {
    expect(usPhoneError('4155550123')).toMatch(/real phone/)
  })
  it('rejects all-identical digits', () => {
    expect(usPhoneError('2222222222')).toMatch(/real phone/)
  })
})

describe('isPossibleUsPhone', () => {
  it('is the boolean inverse of usPhoneError having a reason', () => {
    expect(isPossibleUsPhone('4158675309')).toBe(true)
    expect(isPossibleUsPhone('2222222222')).toBe(false)
    expect(isPossibleUsPhone('')).toBe(false)
  })
})

describe('phoneMatchVariants', () => {
  it('covers every spelling a stored US number might have', () => {
    expect(phoneMatchVariants('(415) 867-5309').sort()).toEqual(
      ['(415) 867-5309', '+14158675309', '4158675309'].sort()
    )
  })
  it('keeps the raw input as typed alongside the canonical forms', () => {
    const v = phoneMatchVariants('415-867-5309')
    expect(v).toContain('415-867-5309')
    expect(v).toContain('(415) 867-5309')
    expect(v).toContain('+14158675309')
    expect(v).toContain('4158675309')
    expect(new Set(v).size).toBe(v.length) // no duplicates
  })
  it('strips a leading 1 country code before building variants', () => {
    expect(phoneMatchVariants('+1 415 867 5309')).toContain('(415) 867-5309')
    expect(phoneMatchVariants('14158675309')).toContain('+14158675309')
  })
  it('falls back to just the raw input for non-10-digit numbers', () => {
    expect(phoneMatchVariants('12345')).toEqual(['12345'])
    expect(phoneMatchVariants('')).toEqual([])
    expect(phoneMatchVariants(null)).toEqual([])
  })
})

// ---- International (2026-08-19: ohACCESS open to any country) ----------------

describe('normalizePhone with a default country', () => {
  it('reads a national-format number in the given country', () => {
    expect(normalizePhone('0412 345 678', 'AU')).toBe('+61412345678')
    expect(normalizePhone('07911 123456', 'GB')).toBe('+447911123456')
    expect(normalizePhone('(416) 555-0100', 'CA')).toBe('+14165550100')
  })
  it('still treats a "+" number as international regardless of default country', () => {
    expect(normalizePhone('+61 412 345 678', 'US')).toBe('+61412345678')
    expect(normalizePhone('+1 415 867 5309', 'AU')).toBe('+14158675309')
  })
  it('returns null for a number too short for its country', () => {
    expect(normalizePhone('0412 345', 'AU')).toBeNull()
  })
})

describe('phoneError (country-aware)', () => {
  it('applies the strict NANP rules for US/CA, with or without +1', () => {
    expect(phoneError('(415) 867-5309', 'US')).toBeNull()
    expect(phoneError('4155550123', 'US')).toMatch(/real phone/)
    expect(phoneError('+1 415 555 0123', 'AU')).toMatch(/real phone/)
    expect(phoneError('2222222222', 'CA')).toMatch(/real phone/)
  })
  it('validates other countries against their own numbering plan', () => {
    expect(phoneError('0412 345 678', 'AU')).toBeNull()
    expect(phoneError('0412 345', 'AU')).toMatch(/valid mobile/)
    expect(phoneError('+447911123456', 'US')).toBeNull()
    expect(phoneError('+44 7911', 'US')).not.toBeNull()
  })
  it('requires something', () => {
    expect(phoneError('', 'AU')).toMatch(/enter/)
    expect(isPossiblePhone('', 'AU')).toBe(false)
    expect(isPossiblePhone('0412 345 678', 'AU')).toBe(true)
  })
  it('defaults to US when no country is given', () => {
    expect(phoneError('4158675309')).toBeNull()
    expect(phoneError('0412345678')).not.toBeNull()
  })
})

describe('phoneMatchVariants for international numbers', () => {
  it('covers E.164, international and national spellings', () => {
    const v = phoneMatchVariants('+61412345678')
    expect(v).toContain('+61412345678')
    expect(v).toContain('+61 412 345 678')
    expect(v).toContain('0412 345 678')
    expect(v).not.toContain('(614) 123-4567')
  })
  it('does not confuse a 10-digit foreign E.164 with a NANP number', () => {
    const v = phoneMatchVariants('+4412345678')
    expect(v.some(s => s.startsWith('('))).toBe(false)
  })
})

describe('formatPhoneDisplay', () => {
  it('keeps NANP numbers in the familiar shape and spaces international ones', () => {
    expect(formatPhoneDisplay('4158675309')).toBe('(415) 867-5309')
    expect(formatPhoneDisplay('+14158675309')).toBe('(415) 867-5309')
    expect(formatPhoneDisplay('+61412345678')).toBe('+61 412 345 678')
    expect(formatPhoneDisplay('0412345678', 'AU')).toBe('+61 412 345 678')
    expect(formatPhoneDisplay('garbage')).toBe('garbage')
    expect(formatPhoneDisplay('')).toBe('')
  })
})

describe('phoneCountry', () => {
  it('tells the country of a number', () => {
    expect(phoneCountry('(415) 867-5309')).toBe('US')
    expect(phoneCountry('(416) 555-0100')).toBe('CA')
    expect(phoneCountry('+61412345678')).toBe('AU')
    expect(phoneCountry('0412345678', 'AU')).toBe('AU')
    expect(phoneCountry('nope')).toBeNull()
  })
})

describe('as-you-type formatting', () => {
  it('keeps the legacy NANP mask for US and Canada', () => {
    expect(formatNanpAsYouType('415')).toBe('(415')
    expect(formatNanpAsYouType('4158')).toBe('(415) 8')
    expect(formatNanpAsYouType('4158675309')).toBe('(415) 867-5309')
    expect(formatNanpAsYouType('41586753091234')).toBe('(415) 867-5309')
    expect(formatNanpAsYouType('')).toBe('')
    expect(formatNationalAsYouType('4158675309', 'US')).toBe('(415) 867-5309')
    expect(formatNationalAsYouType('4165550100', 'CA')).toBe('(416) 555-0100')
  })
  it('formats other countries in their national style', () => {
    expect(formatNationalAsYouType('0412345678', 'AU')).toBe('0412 345 678')
    expect(formatNationalAsYouType('07911123456', 'GB')).toBe('07911 123456')
    expect(formatNationalAsYouType('', 'GB')).toBe('')
  })
})

describe('storablePhone / splitStoredPhone', () => {
  it('stores NANP as the legacy display form and everything else as E.164', () => {
    expect(storablePhone('4158675309', 'US')).toBe('(415) 867-5309')
    expect(storablePhone('+1 415 867 5309', 'AU')).toBe('(415) 867-5309')
    expect(storablePhone('0412 345 678', 'AU')).toBe('+61412345678')
    expect(storablePhone('+61 412 345 678', 'US')).toBe('+61412345678')
    expect(storablePhone('123', 'US')).toBeNull()
    expect(storablePhone('', 'AU')).toBeNull()
  })
  it('splits a stored number back into picker country + national text', () => {
    expect(splitStoredPhone('(415) 867-5309', 'US')).toEqual({ country: 'US', national: '(415) 867-5309' })
    expect(splitStoredPhone('(416) 555-0100', 'CA')).toEqual({ country: 'CA', national: '(416) 555-0100' })
    expect(splitStoredPhone('+61412345678', 'US')).toEqual({ country: 'AU', national: '0412 345 678' })
    expect(splitStoredPhone('', 'AU')).toEqual({ country: 'AU', national: '' })
    expect(splitStoredPhone(null)).toEqual({ country: 'US', national: '' })
  })
  it('round-trips', () => {
    for (const [stored, country] of [['(415) 867-5309', 'US'], ['+61412345678', 'AU'], ['+447911123456', 'GB']] as const) {
      const s = splitStoredPhone(stored, country)
      expect(storablePhone(s.national, s.country)).toBe(stored)
    }
  })
})
