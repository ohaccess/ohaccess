// Time helpers for the weekend-games email. Everything happens in the
// agent's own zone: which day it is, which weekend is next, and the game
// times printed in the email.

// One zone per state (the zone most of its people live in). Agents in the
// split corners (El Paso, the Florida panhandle) see their state's main zone,
// and the email labels it, e.g. "Times are Central Time".
export const STATE_TIME_ZONES: Record<string, string> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix',
  AR: 'America/Chicago', CA: 'America/Los_Angeles', CO: 'America/Denver',
  CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York',
  FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu',
  ID: 'America/Boise', IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis',
  IA: 'America/Chicago', KS: 'America/Chicago', KY: 'America/New_York',
  LA: 'America/Chicago', ME: 'America/New_York', MD: 'America/New_York',
  MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago',
  MS: 'America/Chicago', MO: 'America/Chicago', MT: 'America/Denver',
  NE: 'America/Chicago', NV: 'America/Los_Angeles', NH: 'America/New_York',
  NJ: 'America/New_York', NM: 'America/Denver', NY: 'America/New_York',
  NC: 'America/New_York', ND: 'America/Chicago', OH: 'America/New_York',
  OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York',
  RI: 'America/New_York', SC: 'America/New_York', SD: 'America/Chicago',
  TN: 'America/Chicago', TX: 'America/Chicago', UT: 'America/Denver',
  VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles',
  WV: 'America/New_York', WI: 'America/Chicago', WY: 'America/Denver',
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type ZonedParts = { ymd: string; weekday: number; hour: number; minute: number }

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WEEKDAYS.indexOf(get('weekday')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  }
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// 14, 30 → "2:30 PM"
export function timeLabel(hour: number, minute: number): string {
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`
}

// 18 → "6 PM"
export function hourLabel(hour: number): string {
  return `${hour % 12 || 12} ${hour % 24 < 12 ? 'AM' : 'PM'}`
}

// 13 → "1p"
export function meterHourLabel(hour: number): string {
  return `${hour % 12 || 12}${hour < 12 ? 'a' : 'p'}`
}

// "2026-09-19" → "Sep 19"
export function dateLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d))
  )
}

// "America/Chicago" → "Central Time", "America/Phoenix" → "Mountain Time"
export function timeZoneLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longGeneric' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value
    return name ? name.replace(/ (Standard|Daylight)/, '') : timeZone
  } catch {
    return timeZone
  }
}
