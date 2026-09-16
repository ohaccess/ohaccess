import type { Game, TeamSide } from '../weekend-games/espn'
import { leagueByKey } from '../weekend-games/leagues'
import { zonedParts } from '../weekend-games/time'

// sports_events rows (migration 055) ↔ Game. The table is the planner's
// copy of ESPN's schedule, refreshed weekly by /api/cron/sports-refresh so
// the public page never calls ESPN itself.

export type SportsEventRow = {
  id: string
  league_key: string
  kind: 'game' | 'placeholder' | 'event'
  name: string | null
  importance: number
  start_at: string
  day_et: string
  time_known: boolean
  time_approx: boolean
  home: TeamSide
  away: TeamSide
  home_state: string | null
  away_state: string | null
  neutral: boolean
  city: string | null
  venue_state: string | null
  broadcasts: Game['broadcasts']
  postseason: boolean
  national: boolean
  source: string
  updated_at: string
}

export function etDayOf(iso: string): string {
  return zonedParts(new Date(iso), 'America/New_York').ymd
}

export function rowId(g: Game): string {
  return `${g.league.key}:${g.id}`
}

export function toRow(g: Game, updatedAt: string): SportsEventRow {
  return {
    id: rowId(g),
    league_key: g.league.key,
    kind: g.kind,
    name: g.name,
    importance: g.importance,
    start_at: new Date(g.startIso).toISOString(),
    day_et: etDayOf(g.startIso),
    time_known: g.timeKnown,
    time_approx: g.timeApprox,
    home: g.home,
    away: g.away,
    home_state: g.home.homeState,
    away_state: g.away.homeState,
    neutral: g.neutral,
    city: g.city,
    venue_state: g.venueState,
    broadcasts: g.broadcasts,
    postseason: g.postseason,
    national: g.national,
    source: 'espn',
    updated_at: updatedAt,
  }
}

// Null for a league the code no longer knows (dropped from leagues.ts).
export function fromRow(r: SportsEventRow): Game | null {
  const league = leagueByKey(r.league_key)
  if (!league) return null
  return {
    id: r.id.startsWith(`${r.league_key}:`) ? r.id.slice(r.league_key.length + 1) : r.id,
    league,
    kind: r.kind,
    name: r.name,
    importance: r.importance,
    startIso: r.start_at,
    timeKnown: r.time_known,
    timeApprox: r.time_approx,
    home: r.home,
    away: r.away,
    neutral: r.neutral,
    city: r.city,
    venueState: r.venue_state,
    broadcasts: r.broadcasts,
    postseason: r.postseason,
    national: r.national,
  }
}

// What the /api/planner response carries per game: the league by key, so
// the browser re-attaches the LeagueDef and the payload stays small.
export type WireGame = Omit<Game, 'league'> & { leagueKey: string }

export function toWire(g: Game): WireGame {
  const { league, ...rest } = g
  return { ...rest, leagueKey: league.key }
}

export function fromWire(w: WireGame): Game | null {
  const league = leagueByKey(w.leagueKey)
  if (!league) return null
  const { leagueKey: _key, ...rest } = w
  void _key
  return { ...rest, league }
}

// What /api/planner returns.
export type PlannerResponse = {
  state: string
  from: string
  to: string
  games: WireGame[]
  // When the schedule was last refreshed from ESPN, and the last day it
  // reaches. Null until the first refresh has run.
  refreshedAt: string | null
  horizon: string | null
}
