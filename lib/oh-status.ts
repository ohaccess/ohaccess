// Single source of truth for "where does an open house sit relative to now" —
// past, current (live right now), or future. Used by the admin map pins AND
// the admin Open Houses table so they can never disagree (the table used to
// collapse this to a binary past/upcoming, which labeled LIVE open houses as
// "Upcoming").

export type OhStatus = 'past' | 'current' | 'future'

// Structured start_at/end_at when present; legacy rows fall back to the
// free-text date (counted as "current" for its whole day, matching how
// /r/[code] treats day precision). Anything unparseable sorts to 'past'.
export function ohStatus(
  oh: { start_at: string | null; end_at: string | null; open_house_date: string | null },
  now: number
): OhStatus {
  const start = oh.start_at ? Date.parse(oh.start_at) : NaN
  const end = oh.end_at ? Date.parse(oh.end_at) : NaN
  if (!Number.isNaN(start)) {
    if (now < start) return 'future'
    if (!Number.isNaN(end) && now <= end) return 'current'
    return 'past'
  }
  const day = oh.open_house_date ? Date.parse(oh.open_house_date) : NaN
  if (!Number.isNaN(day)) {
    if (now < day) return 'future'
    if (now <= day + 24 * 60 * 60 * 1000) return 'current'
  }
  return 'past'
}
