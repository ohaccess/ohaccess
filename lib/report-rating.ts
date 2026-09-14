// One-tap agent ratings from the post-event report email (migration 053).
// The pure rules, shared by the /rate page, its save route, the admin
// overview and the tests. The signed-link half lives in
// lib/report-rating-link.ts (server-only).

export const RATING_MAX = 5
export const RATING_COMMENT_MAX = 2000

// A whole number 1 to 5 (from a query string or a JSON body), else null.
export function parseRatingScore(value: unknown): number | null {
  const n =
    typeof value === 'number' ? value
    : typeof value === 'string' && /^\s*\d\s*$/.test(value) ? Number(value)
    : NaN
  return Number.isInteger(n) && n >= 1 && n <= RATING_MAX ? n : null
}

// Trimmed comment, null when blank, or an error when too long.
export function cleanRatingComment(value: unknown): { ok: true; comment: string | null } | { ok: false } {
  if (value === null || value === undefined) return { ok: true, comment: null }
  if (typeof value !== 'string') return { ok: false }
  const comment = value.trim()
  if (comment.length > RATING_COMMENT_MAX) return { ok: false }
  return { ok: true, comment: comment || null }
}

export type RatingSummary = {
  countAll: number
  avgAll: number | null
  count30d: number
  avg30d: number | null
}

const avg = (scores: number[]) =>
  scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null

// Averages (one decimal) overall and for ratings given or changed in the
// last 30 days.
export function summarizeRatings(
  rows: { score: number; updated_at: string }[],
  nowMs: number
): RatingSummary {
  const cutoff = nowMs - 30 * 24 * 60 * 60 * 1000
  const all = rows.map(r => r.score)
  const recent = rows.filter(r => Date.parse(r.updated_at) >= cutoff).map(r => r.score)
  return { countAll: all.length, avgAll: avg(all), count30d: recent.length, avg30d: avg(recent) }
}
