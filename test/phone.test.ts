import { describe, it, expect } from 'vitest'
import { normalizePhone, usPhoneError, isPossibleUsPhone } from '@/lib/phone'

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
