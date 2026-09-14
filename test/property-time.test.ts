import { describe, it, expect } from 'vitest'
import { formatPropertyTime } from '../lib/property-time'

// Newer ICU puts a narrow no-break space before AM/PM; compare on plain spaces.
const plain = (s: string) => s.replace(/\s/g, ' ')

describe('formatPropertyTime', () => {
  const signIn = '2026-09-13T19:30:00Z'

  it("shows the time in the property's timezone", () => {
    expect(plain(formatPropertyTime(signIn, 'America/Denver'))).toBe('Sep 13, 1:30 PM')
    expect(plain(formatPropertyTime(signIn, 'America/Chicago'))).toBe('Sep 13, 2:30 PM')
    expect(plain(formatPropertyTime(signIn, 'Australia/Sydney'))).toBe('Sep 14, 5:30 AM')
  })

  it('has a CSV style with the year', () => {
    expect(plain(formatPropertyTime(signIn, 'America/Denver', 'csv'))).toBe('9/13/2026, 1:30 PM')
  })

  it("falls back to the viewer's timezone when the property has none or a bad one", () => {
    const viewer = new Date(signIn).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    expect(formatPropertyTime(signIn, null)).toBe(viewer)
    expect(formatPropertyTime(signIn, 'Not/AZone')).toBe(viewer)
  })

  it('returns an empty string for a missing or invalid time', () => {
    expect(formatPropertyTime(null, 'America/Denver')).toBe('')
    expect(formatPropertyTime('not a date', 'America/Denver')).toBe('')
  })
})
