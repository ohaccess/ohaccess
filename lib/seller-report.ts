// Aggregate stats for the shareable seller report card (/report/<code>).
// Deliberately PII-free: the seller sees counts and timelines, never visitor
// names or contact info — visitors consented to sharing their details with
// the hosting agent, not the seller (and agents don't want sellers contacting
// buyers directly either).

import { TIMELINE_ORDER } from '@/lib/timeline'

export interface SellerReportStats {
  total: number
  // Timeline buckets in soonest-first order, zero-count buckets dropped, with
  // anything unrecognized collected under "Other".
  groups: { label: string; count: number }[]
  // Visitors in the two soonest buckets (buying within ~6 months) — the
  // headline number a seller cares about.
  soonCount: number
  // Scan → registration funnel, or null when the scan log can't be trusted
  // for this event (the qr_scans table is younger than some open houses, so a
  // scan count below the registration count means the log missed the event).
  funnel: { scans: number; registered: number } | null
  // Post-visit feedback, aggregated PII-free, or null when nobody answered.
  // avgRating is the mean of the 1–10 overall ratings (one decimal); price is
  // the count of each sentiment. responses = visitors who submitted feedback.
  feedback: {
    responses: number
    avgRating: number
    price: { high: number; reasonable: number; low: number }
  } | null
}

const OTHER_LABEL = 'Other'

export interface SellerReportVisitor {
  purchasing_timeline: string | null
  feedback_rating?: number | null
  feedback_price?: string | null
}

export function buildSellerReportStats(
  visitors: SellerReportVisitor[],
  scanCount: number
): SellerReportStats {
  const total = visitors.length

  const groups: { label: string; count: number }[] = []
  for (const label of TIMELINE_ORDER) {
    const count = visitors.filter(v => v.purchasing_timeline === label).length
    if (count > 0) groups.push({ label, count })
  }
  const other = visitors.filter(
    v => !TIMELINE_ORDER.includes(v.purchasing_timeline || '')
  ).length
  if (other > 0) groups.push({ label: OTHER_LABEL, count: other })

  const soonCount = visitors.filter(v =>
    TIMELINE_ORDER.slice(0, 2).includes(v.purchasing_timeline || '')
  ).length

  const funnel =
    scanCount > 0 && scanCount >= total ? { scans: scanCount, registered: total } : null

  // A response requires both answers (the form submits them together), so a
  // numeric rating is a reliable marker of a completed feedback row.
  const rated = visitors
    .map(v => v.feedback_rating)
    .filter((r): r is number => typeof r === 'number')
  const feedback =
    rated.length > 0
      ? {
          responses: rated.length,
          avgRating: Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10,
          price: {
            high: visitors.filter(v => v.feedback_price === 'Too High').length,
            reasonable: visitors.filter(v => v.feedback_price === 'Reasonable').length,
            low: visitors.filter(v => v.feedback_price === 'Too Low').length,
          },
        }
      : null

  return { total, groups, soonCount, funnel, feedback }
}
