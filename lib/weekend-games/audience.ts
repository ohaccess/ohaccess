import { normalizeStateCode } from '../hardware-offer'
import { inferProfileCountry } from '../regions'
import { STATE_TIME_ZONES, addDays, zonedParts } from './time'

// Who gets the Wednesday weekend-games email, and when. Rules approved by
// Dave 2026-09-13: US agents whose Settings are filled in, 8 AM Wednesday in
// their own time zone, whether or not they already have an open house booked
// ("they can always adjust"). Opt-outs are checked by the cron, same as drip.

export const SEND_WEEKDAY = 3 // Wednesday
// 8 AM local, plus two hourly catch-up runs if a run is missed or runs over.
export const SEND_HOURS = [8, 9, 10]

export type AudienceProfile = {
  full_name?: string | null
  brokerage?: string | null
  phone?: string | null
  license_number?: string | null
  state?: string | null
  country?: string | null
}

const REQUIRED_SETTINGS = ['full_name', 'brokerage', 'phone', 'license_number', 'state'] as const

export function settingsComplete(p: AudienceProfile): boolean {
  return REQUIRED_SETTINGS.every((field) => !!String(p[field] ?? '').trim())
}

// The agent's 2-letter state if they should get the email, else null.
export function weekendGamesState(p: AudienceProfile): string | null {
  if (!settingsComplete(p)) return null
  if (inferProfileCountry(p) !== 'US') return null
  return normalizeStateCode(p.state)
}

export function agentTimeZone(state: string): string {
  return STATE_TIME_ZONES[state] ?? 'America/New_York'
}

// The coming Saturday if it's send time for this agent, else null.
//
// Catch-up mode (the cron called by hand with ?catchup=true after a missed
// Wednesday) ignores the 8 to 10 AM window: any time from Wednesday through
// Friday counts, so the email still lands before the weekend it describes.
// The at-most-once ledger keeps a catch-up from re-sending to anyone who
// already got that weekend's email.
export function sendDue(
  now: Date,
  timeZone: string,
  opts: { catchup?: boolean } = {}
): { saturdayYmd: string } | null {
  const local = zonedParts(now, timeZone)
  if (opts.catchup) {
    if (local.weekday < SEND_WEEKDAY || local.weekday > 5) return null
    return { saturdayYmd: addDays(local.ymd, 6 - local.weekday) }
  }
  if (local.weekday !== SEND_WEEKDAY || !SEND_HOURS.includes(local.hour)) return null
  return { saturdayYmd: addDays(local.ymd, 3) }
}

// agent_email_log key: one email per agent per weekend.
export function weekendGamesEmailKey(saturdayYmd: string): string {
  return `weekend_games_${saturdayYmd}`
}
