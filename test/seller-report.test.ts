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
  })
})
