// When an open house stops taking online sign-ins, and when rescheduling one
// should re-arm its day-before reminder. Pure, so the register page, the
// register API, the expired-lead lookup and the dashboard all share one rule.

// Online sign-in closes this long after the scheduled end. After that the
// register link shows the expired card (agent contact + lead form) instead of
// the form, so a QR sign left up, or an old link, can't add strangers to a
// finished event's visitor log. Checked against the CURRENT end_at at scan
// time, so an agent who reuses an open house by editing its date reopens the
// same link automatically.
export const SIGNIN_CLOSES_AFTER_END_MS = 6 * 60 * 60 * 1000

// True once now is more than SIGNIN_CLOSES_AFTER_END_MS past end_at. Legacy
// rows with no structured end time never close (there's nothing reliable to
// measure from).
export function signInEnded(endAt: string | null | undefined, now: number): boolean {
  if (!endAt) return false
  const end = Date.parse(endAt)
  if (Number.isNaN(end)) return false
  return now > end + SIGNIN_CLOSES_AFTER_END_MS
}

// Moving an open house's start by at least this much counts as a new date,
// so its day-before reminder should go out again. A same-day time tweak on an
// already-reminded open house shouldn't send a second reminder.
export const REMINDER_RESET_SHIFT_MS = 12 * 60 * 60 * 1000

export function rescheduleResetsReminder(
  oldStartAt: string | null | undefined,
  newStartAt: string | null | undefined
): boolean {
  if (!newStartAt) return false
  const next = Date.parse(newStartAt)
  if (Number.isNaN(next)) return false
  const prev = oldStartAt ? Date.parse(oldStartAt) : NaN
  if (Number.isNaN(prev)) return true
  return Math.abs(next - prev) >= REMINDER_RESET_SHIFT_MS
}

// An open house becomes read-only for its agent this long after the scheduled
// end: visitors' consent records name the address and date they signed in at,
// so a finished event can't be re-pointed at another property or day (reuse
// goes through Duplicate instead). The grace lets an agent who is running over
// push the end time later, which moves the lock with it. Migration 056
// enforces the same rule in the database; keep the two in step.
export const EDIT_LOCKS_AFTER_END_MS = 30 * 60 * 1000

// True once now is more than EDIT_LOCKS_AFTER_END_MS past end_at. Rows with no
// structured end time never lock (same reasoning as signInEnded).
export function editLocked(endAt: string | null | undefined, now: number): boolean {
  if (!endAt) return false
  const end = Date.parse(endAt)
  if (Number.isNaN(end)) return false
  return now > end + EDIT_LOCKS_AFTER_END_MS
}

// A finished open house that nobody signed in at drops off the agent's
// dashboard list this long after its end (it stays in the database and behind
// the "Show past open houses" toggle). Hidden, not deleted: its scan data, any
// printed QR code, and the admin view of washout events all still hang off the
// row.
export const EMPTY_PAST_HIDES_AFTER_MS = 30 * 24 * 60 * 60 * 1000

// True for an open house with zero visitors that ended more than
// EMPTY_PAST_HIDES_AFTER_MS ago. `visitors` is null while the count is still
// loading, which never hides (a card shouldn't vanish on a guess). Rows with no
// structured end time never hide.
export function hideEmptyPast(endAt: string | null | undefined, visitors: number | null, now: number): boolean {
  if (visitors === null || visitors > 0 || !endAt) return false
  const end = Date.parse(endAt)
  if (Number.isNaN(end)) return false
  return now > end + EMPTY_PAST_HIDES_AFTER_MS
}
