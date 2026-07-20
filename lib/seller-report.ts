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
}

const OTHER_LABEL = 'Other'

export function buildSellerReportStats(
  visitors: { purchasing_timeline: string | null }[],
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

  return { total, groups, soonCount, funnel }
}
