import { describe, expect, it } from 'vitest'
import { getHoliday, getSeason, heroImage } from '../lib/season'

const at = (iso: string) => getSeason(Date.parse(iso))

describe('getSeason', () => {
  it('returns the season for mid-season dates', () => {
    expect(at('2026-01-15T12:00Z')).toBe('winter')
    expect(at('2026-04-15T12:00Z')).toBe('spring')
    expect(at('2026-08-06T12:00Z')).toBe('summer')
    expect(at('2026-10-31T12:00Z')).toBe('fall')
  })

  it('flips at the exact equinox/solstice instant', () => {
    // 2026 September equinox: Sep 23 00:05 UTC
    expect(at('2026-09-23T00:04Z')).toBe('summer')
    expect(at('2026-09-23T00:05Z')).toBe('fall')
    // 2026 December solstice: Dec 21 20:50 UTC
    expect(at('2026-12-21T20:49Z')).toBe('fall')
    expect(at('2026-12-21T20:50Z')).toBe('winter')
    // 2027 March equinox: Mar 20 20:25 UTC
    expect(at('2027-03-20T20:24Z')).toBe('winter')
    expect(at('2027-03-20T20:25Z')).toBe('spring')
    // 2027 June solstice: Jun 21 14:11 UTC
    expect(at('2027-06-21T14:10Z')).toBe('spring')
    expect(at('2027-06-21T14:11Z')).toBe('summer')
  })

  it('falls back to typical dates for years outside the table', () => {
    expect(at('2040-01-15T12:00Z')).toBe('winter')
    expect(at('2040-05-01T12:00Z')).toBe('spring')
    expect(at('2040-07-15T12:00Z')).toBe('summer')
    expect(at('2040-11-01T12:00Z')).toBe('fall')
    expect(at('2040-12-25T12:00Z')).toBe('winter')
  })
})

describe('getHoliday', () => {
  // new Date(year, month, day) is the visitor's local calendar — exactly
  // what the holiday windows are defined in.
  const on = (month: number, day: number) => getHoliday(new Date(2026, month - 1, day, 15, 0))

  it('shows Halloween from Oct 24 through Oct 31', () => {
    expect(on(10, 23)).toBeNull()
    expect(on(10, 24)).toBe('halloween')
    expect(on(10, 31)).toBe('halloween')
    expect(on(11, 1)).toBeNull()
  })

  it('shows Christmas from Dec 18 through Dec 25', () => {
    expect(on(12, 17)).toBeNull()
    expect(on(12, 18)).toBe('christmas')
    expect(on(12, 25)).toBe('christmas')
    expect(on(12, 26)).toBeNull()
  })

  it('is off the rest of the year', () => {
    expect(on(8, 6)).toBeNull()
    expect(on(10, 1)).toBeNull()
    expect(on(12, 1)).toBeNull()
  })
})

describe('heroImage', () => {
  it('maps each season to its public image path', () => {
    expect(heroImage('summer')).toBe('/record-hero-summer.jpg')
    expect(heroImage('winter')).toBe('/record-hero-winter.jpg')
  })
})
