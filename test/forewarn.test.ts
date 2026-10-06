import { describe, it, expect } from 'vitest'
import { forewarnSearchDigits } from '@/lib/forewarn'

describe('forewarnSearchDigits', () => {
  it('returns the 10 national digits for a stored US number', () => {
    expect(forewarnSearchDigits('(512) 555-1234')).toBe('5125551234')
  })
  it('strips a leading +1 / 1 country code', () => {
    expect(forewarnSearchDigits('+15125551234')).toBe('5125551234')
    expect(forewarnSearchDigits('1 512 555 1234')).toBe('5125551234')
  })
  it('gives no button for non-US numbers', () => {
    expect(forewarnSearchDigits('+61412345678')).toBeNull()
    expect(forewarnSearchDigits('+447700900123')).toBeNull()
  })
  it('gives no button for empty or malformed values', () => {
    expect(forewarnSearchDigits(null)).toBeNull()
    expect(forewarnSearchDigits('')).toBeNull()
    expect(forewarnSearchDigits('555-1234')).toBeNull()
  })
})
