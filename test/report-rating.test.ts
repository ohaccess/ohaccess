import { describe, it, expect } from 'vitest'
import { parseRatingScore, cleanRatingComment, summarizeRatings, RATING_COMMENT_MAX } from '@/lib/report-rating'
import { reportRatingSignature, reportRatingUrl, verifyReportRating } from '@/lib/report-rating-link'

const OH = '3f2c9a1e-8b7d-4c6e-9f0a-1b2c3d4e5f60'

describe('parseRatingScore', () => {
  it('accepts 1 to 5 as numbers or strings', () => {
    expect(parseRatingScore(1)).toBe(1)
    expect(parseRatingScore('5')).toBe(5)
    expect(parseRatingScore(' 3 ')).toBe(3)
  })
  it('rejects anything else', () => {
    for (const v of [0, 6, 2.5, '10', 'x', '', null, undefined, '4abc']) {
      expect(parseRatingScore(v)).toBeNull()
    }
  })
})

describe('cleanRatingComment', () => {
  it('trims, and blank becomes null', () => {
    expect(cleanRatingComment('  great ')).toEqual({ ok: true, comment: 'great' })
    expect(cleanRatingComment('   ')).toEqual({ ok: true, comment: null })
    expect(cleanRatingComment(undefined)).toEqual({ ok: true, comment: null })
  })
  it('rejects non-strings and over-long comments', () => {
    expect(cleanRatingComment(42).ok).toBe(false)
    expect(cleanRatingComment('x'.repeat(RATING_COMMENT_MAX + 1)).ok).toBe(false)
  })
})

describe('summarizeRatings', () => {
  const now = Date.parse('2026-09-14T12:00:00Z')
  it('averages overall and the last 30 days, one decimal', () => {
    const s = summarizeRatings([
      { score: 5, updated_at: '2026-09-13T12:00:00Z' },
      { score: 4, updated_at: '2026-09-01T12:00:00Z' },
      { score: 2, updated_at: '2026-07-01T12:00:00Z' },
    ], now)
    expect(s).toEqual({ countAll: 3, avgAll: 3.7, count30d: 2, avg30d: 4.5 })
  })
  it('is null-safe with no ratings', () => {
    expect(summarizeRatings([], now)).toEqual({ countAll: 0, avgAll: null, count30d: 0, avg30d: null })
  })
})

describe('report rating links', () => {
  it('verifies its own signature and nothing else', () => {
    const sig = reportRatingSignature(OH)
    expect(verifyReportRating(OH, sig)).toBe(true)
    expect(verifyReportRating(OH, sig.toUpperCase())).toBe(true)
    expect(verifyReportRating('00000000-0000-4000-8000-000000000000', sig)).toBe(false)
    expect(verifyReportRating(OH, 'not-a-signature')).toBe(false)
    expect(verifyReportRating(OH, '')).toBe(false)
  })
  it('builds a www link carrying the score', () => {
    const url = reportRatingUrl(OH, 4)
    expect(url.startsWith(`https://www.ohaccess.com/rate/${OH}/`)).toBe(true)
    expect(url.endsWith('?score=4')).toBe(true)
  })
})
