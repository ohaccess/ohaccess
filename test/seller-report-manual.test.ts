import { describe, it, expect } from 'vitest'
import { buildSellerReportStats } from '@/lib/seller-report'

const signIn = (t: string) => ({ purchasing_timeline: t, source: 'ohaccess' })
const byHand = (t: string | null) => ({ purchasing_timeline: t, source: 'manual' })

describe('seller report with hand-added visitors', () => {
  it('counts them in the total and timelines, but not as verified', () => {
    const s = buildSellerReportStats([signIn('0–3 Months'), signIn('3–6 Months'), byHand('0–3 Months')], 5)
    expect(s.total).toBe(3)
    expect(s.verifiedCount).toBe(2)
    expect(s.soonCount).toBe(3)
  })
  it('treats legacy rows without a source as signed in', () => {
    expect(buildSellerReportStats([{ purchasing_timeline: '0–3 Months' }], 0).verifiedCount).toBe(1)
  })
  it('compares scans with self sign-ins only', () => {
    const s = buildSellerReportStats([signIn('0–3 Months'), byHand(null), byHand(null)], 2)
    expect(s.funnel).toEqual({ scans: 2, registered: 1 })
  })
  it('drops the funnel when nobody signed in themselves', () => {
    expect(buildSellerReportStats([byHand(null)], 4).funnel).toBeNull()
  })
})
