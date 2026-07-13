import { describe, it, expect } from 'vitest'
import { ohStatus } from '@/lib/oh-status'

// Fixed "now": 2026-07-12 18:00 UTC (1 PM Central on a Sunday afternoon).
const NOW = Date.parse('2026-07-12T18:00:00Z')

const oh = (start: string | null, end: string | null, date: string | null = null) => ({
  start_at: start,
  end_at: end,
  open_house_date: date,
})

describe('ohStatus', () => {
  it('classifies an open house happening RIGHT NOW as current — the admin-tab bug', () => {
    // Started an hour ago, ends in an hour. This was showing as "Upcoming".
    expect(ohStatus(oh('2026-07-12T17:00:00Z', '2026-07-12T19:00:00Z'), NOW)).toBe('current')
  })

  it('is current at the exact start and end instants', () => {
    expect(ohStatus(oh('2026-07-12T18:00:00Z', '2026-07-12T20:00:00Z'), NOW)).toBe('current')
    expect(ohStatus(oh('2026-07-12T16:00:00Z', '2026-07-12T18:00:00Z'), NOW)).toBe('current')
  })

  it('classifies one starting later as future', () => {
    expect(ohStatus(oh('2026-07-12T19:00:00Z', '2026-07-12T21:00:00Z'), NOW)).toBe('future')
    expect(ohStatus(oh('2026-07-19T17:00:00Z', '2026-07-19T19:00:00Z'), NOW)).toBe('future')
  })

  it('classifies one that ended as past', () => {
    expect(ohStatus(oh('2026-07-12T14:00:00Z', '2026-07-12T16:00:00Z'), NOW)).toBe('past')
    expect(ohStatus(oh('2026-07-05T17:00:00Z', '2026-07-05T19:00:00Z'), NOW)).toBe('past')
  })

  it('treats a started row with no end time as past (cannot know it is still running)', () => {
    expect(ohStatus(oh('2026-07-12T17:00:00Z', null), NOW)).toBe('past')
  })

  it('legacy free-text date rows: today = current, tomorrow = future, yesterday = past', () => {
    expect(ohStatus(oh(null, null, 'Sunday, July 12, 2026'), NOW)).toBe('current')
    expect(ohStatus(oh(null, null, 'Monday, July 13, 2026'), NOW)).toBe('future')
    expect(ohStatus(oh(null, null, 'Saturday, July 11, 2026'), NOW)).toBe('past')
  })

  it('rows with nothing parseable sort to past', () => {
    expect(ohStatus(oh(null, null, null), NOW)).toBe('past')
    expect(ohStatus(oh(null, null, 'sometime soon'), NOW)).toBe('past')
  })
})
