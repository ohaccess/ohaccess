// View-filter helpers for the open-house map. Pure functions so the weekend
// window and default-visibility rules are unit-testable; the map component
// applies them client-side (dates resolve in the viewer's timezone).

// The Saturday-through-Sunday window of the current-or-upcoming weekend:
// on Sunday that's the weekend you're in (yesterday's Saturday), any other
// day it's the next Saturday. `end` is exclusive (Monday 00:00).
export function weekendWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = start.getDay()
  start.setDate(start.getDate() + (day === 0 ? -1 : 6 - day))
  const end = new Date(start)
  end.setDate(end.getDate() + 2)
  return { start, end }
}

// Whether an open house overlaps the weekend window. Legacy rows without a
// structured start time can't be classified and are excluded when the
// weekend filter is on.
export function inWeekend(startAt: string | null, endAt: string | null, now: Date): boolean {
  if (!startAt) return false
  const s = new Date(startAt)
  if (isNaN(s.getTime())) return false
  const eRaw = endAt ? new Date(endAt) : s
  const e = isNaN(eRaw.getTime()) ? s : eRaw
  const { start, end } = weekendWindow(now)
  return s < end && e >= start
}

// Past pins start hidden once they dominate the map — a wall of gray drowns
// out the live/upcoming pins agents actually care about. The chip still shows
// the count, so one tap brings them back.
export function pastHiddenByDefault(current: number, future: number, past: number): boolean {
  return past >= 5 && past > current + future
}
