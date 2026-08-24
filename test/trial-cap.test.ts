import { describe, it, expect } from 'vitest'
import { graceAllowsRegistration, GRACE_AFTER_END_MS } from '@/lib/trial-cap'

// The one open house the cap-crossing visitor signed in at may keep
// collecting until GRACE_AFTER_END_MS past its scheduled end; every other
// open house gets the hard stop.

const OH = 'oh-grace'
const OTHER = 'oh-other'
const start = Date.parse('2026-08-24T18:00:00Z')
const end = Date.parse('2026-08-24T20:00:00Z')

const args = (overrides: Partial<Parameters<typeof graceAllowsRegistration>[0]> = {}) => ({
  nowMs: start + 60_000,
  openHouseId: OH,
  startAt: '2026-08-24T18:00:00Z',
  endAt: '2026-08-24T20:00:00Z',
  capVisitorOpenHouseId: OH,
  ...overrides,
})

describe('graceAllowsRegistration', () => {
  it('allows the cap-crossing open house while it is running', () => {
    expect(graceAllowsRegistration(args())).toBe(true)
  })

  it('keeps allowing until 30 minutes after the scheduled end', () => {
    expect(graceAllowsRegistration(args({ nowMs: end + GRACE_AFTER_END_MS }))).toBe(true)
    expect(graceAllowsRegistration(args({ nowMs: end + GRACE_AFTER_END_MS + 1 }))).toBe(false)
  })

  it('blocks any open house the cap was not crossed at — pre-scheduled future events get no window', () => {
    expect(graceAllowsRegistration(args({ openHouseId: OTHER }))).toBe(false)
    expect(graceAllowsRegistration(args({ capVisitorOpenHouseId: OTHER }))).toBe(false)
    expect(graceAllowsRegistration(args({ capVisitorOpenHouseId: null }))).toBe(false)
  })

  it('blocks before the event starts', () => {
    expect(graceAllowsRegistration(args({ nowMs: start - 1 }))).toBe(false)
    expect(graceAllowsRegistration(args({ nowMs: start }))).toBe(true)
  })

  it('gives legacy open houses without structured times no grace', () => {
    expect(graceAllowsRegistration(args({ startAt: null }))).toBe(false)
    expect(graceAllowsRegistration(args({ endAt: null }))).toBe(false)
    expect(graceAllowsRegistration(args({ startAt: 'not a date' }))).toBe(false)
  })
})
