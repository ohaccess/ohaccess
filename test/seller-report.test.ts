import { describe, it, expect } from 'vitest'
import { buildSellerReportStats } from '@/lib/seller-report'

const v = (timeline: string | null) => ({ purchasing_timeline: timeline })

describe('buildSellerReportStats', () => {
  it('groups timelines soonest-first and drops empty buckets', () => {
    const stats = buildSellerReportStats(
      [v('12+ Months'), v('0–3 Months'), v('0–3 Months'), v('6–12 Months')],
      0
    )
    expect(stats.total).toBe(4)
    expect(stats.groups).toEqual([
      { label: '0–3 Months', count: 2 },
      { label: '6–12 Months', count: 1 },
      { label: '12+ Months', count: 1 },
    ])
  })

  it('collects unrecognized and missing timelines under Other', () => {
    const stats = buildSellerReportStats([v('0–3 Months'), v(null), v('Just browsing')], 0)
    expect(stats.groups).toEqual([
      { label: '0–3 Months', count: 1 },
      { label: 'Other', count: 2 },
    ])
  })

  it('counts the two soonest buckets as buying within 6 months', () => {
    const stats = buildSellerReportStats(
      [v('0–3 Months'), v('3–6 Months'), v('6–12 Months'), v(null)],
      0
    )
    expect(stats.soonCount).toBe(2)
  })

  it('shows the scan funnel only when the scan log covers the event', () => {
    // Scan log predates the open house: fewer scans than registrations.
    expect(buildSellerReportStats([v(null), v(null), v(null)], 1).funnel).toBeNull()
    // No scans recorded at all.
    expect(buildSellerReportStats([v(null)], 0).funnel).toBeNull()
    // Healthy funnel: at least as many scans as registrations.
    expect(buildSellerReportStats([v(null), v(null)], 5).funnel).toEqual({
      scans: 5,
      registered: 2,
    })
  })

  it('handles an empty visitor list', () => {
    const stats = buildSellerReportStats([], 0)
    expect(stats.total).toBe(0)
    expect(stats.groups).toEqual([])
    expect(stats.soonCount).toBe(0)
    expect(stats.funnel).toBeNull()
    expect(stats.feedback).toBeNull()
  })

  it('returns null feedback when nobody answered', () => {
    expect(buildSellerReportStats([v('0–3 Months'), v(null)], 0).feedback).toBeNull()
  })

  it('aggregates feedback: mean rating (one decimal) and price sentiment counts', () => {
    const fb = (timeline: string | null, rating: number | null, price: string | null) => ({
      purchasing_timeline: timeline,
      feedback_rating: rating,
      feedback_price: price,
    })
    const stats = buildSellerReportStats(
      [
        fb('0–3 Months', 8, 'Too High'),
        fb('3–6 Months', 7, 'Reasonable'),
        fb('6–12 Months', 6, 'Too High'),
        fb('12+ Months', null, null), // registered but left no feedback
      ],
      0
    )
    expect(stats.feedback).toEqual({
      responses: 3,
      avgRating: 7, // (8+7+6)/3
      price: { high: 2, reasonable: 1, low: 0 },
    })
  })

  it('rounds the average rating to one decimal', () => {
    const fb = (rating: number) => ({ purchasing_timeline: null, feedback_rating: rating, feedback_price: 'Reasonable' })
    const stats = buildSellerReportStats([fb(8), fb(9), fb(9)], 0) // 26/3 = 8.666…
    expect(stats.feedback?.avgRating).toBe(8.7)
  })
})
