import { describe, it, expect } from 'vitest'
import { accentOnPrimary } from '@/lib/colors'

// The initials in the fallback avatar circle are drawn in the accent color on
// a primary-color fill — unless the agent picked the same color for both,
// where they'd vanish; then white on dark primaries, black on light ones.
describe('accentOnPrimary', () => {
  it('returns the accent when the two colors differ', () => {
    expect(accentOnPrimary('#0b3d91', '#d4af37')).toBe('#d4af37')
  })

  it('falls back to white when both match and the primary is dark', () => {
    expect(accentOnPrimary('#0b3d91', '#0b3d91')).toBe('#ffffff')
  })

  it('falls back to black when both match and the primary is light', () => {
    expect(accentOnPrimary('#f5e6c8', '#f5e6c8')).toBe('#1d1d1f')
  })

  it('matches across case and shorthand hex forms', () => {
    expect(accentOnPrimary('#0B3D91', '#0b3d91')).toBe('#ffffff')
    expect(accentOnPrimary('#ffcc00', '#fc0')).toBe('#1d1d1f')
  })
})
