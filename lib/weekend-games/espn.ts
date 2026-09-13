/* eslint-disable @typescript-eslint/no-explicit-any -- ESPN's feed is untyped JSON; every field is checked as it's read */
import teamStatesJson from './team-states.json'
import { normalizeStateCode } from '../hardware-offer'
import { LEAGUES, type LeagueDef } from './leagues'

// Reads ESPN's public scoreboard feed (no key, no cost, but unofficial, so
// the cron treats any failure or odd shape as "don't send this week") and
// normalizes each game into the few facts the weekend-games email needs.

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports'

type TeamStates = Record<string, Record<string, { s: string; n: string }>>
const TEAM_STATES = teamStatesJson as TeamStates

export type TeamSide = {
  id: string
  short: string // "Cowboys", "Texas A&M"
  nickname: string // "Cowboys", "Aggies"
  rank: number | null // AP Top 25, college only
  homeState: string | null // from team-states.json
}

export type Game = {
  id: string
  league: LeagueDef
  startIso: string
  timeKnown: boolean // false = kickoff not announced yet (TBA)
  home: TeamSide
  away: TeamSide
  neutral: boolean
  city: string | null
  venueState: string | null
  broadcasts: { national: string[]; home: string[]; away: string[] }
  postseason: boolean
}

const SKIP_STATUSES = new Set([
  'STATUS_POSTPONED',
  'STATUS_CANCELED',
  'STATUS_SUSPENDED',
  'STATUS_FORFEIT',
])

export function stateFromEspn(raw: unknown): string | null {
  const value = String(raw ?? '').trim()
  if (!value) return null
  if (/^district of columbia$/i.test(value)) return 'DC'
  return normalizeStateCode(value)
}

// ESPN mostly sends { city: "Arlington", state: "TX" }, but also "Texas" as
// the state, "Houston, Texas" as the city with no state, or the stadium name
// as the city.
export function venueLocation(
  address: { city?: unknown; state?: unknown } | null | undefined,
  venueName?: string | null
): { city: string | null; state: string | null } {
  const rawCity = String(address?.city ?? '').trim()
  let state = stateFromEspn(address?.state)
  let city = rawCity
  const comma = rawCity.lastIndexOf(',')
  if (comma >= 0) {
    const tail = stateFromEspn(rawCity.slice(comma + 1))
    if (tail) {
      state = state ?? tail
      city = rawCity.slice(0, comma).trim()
    }
  }
  if (venueName && city.toLowerCase() === venueName.trim().toLowerCase()) city = ''
  return { city: city || null, state }
}

function side(c: any, league: LeagueDef): TeamSide {
  const team = c?.team ?? {}
  const id = String(team.id ?? '')
  const short = String(team.shortDisplayName || team.displayName || team.abbreviation || 'TBD')
  const rankValue = Number(c?.curatedRank?.current)
  return {
    id,
    short,
    nickname: String(team.name || short),
    rank: Number.isInteger(rankValue) && rankValue >= 1 && rankValue <= 25 ? rankValue : null,
    homeState: TEAM_STATES[league.key]?.[id]?.s ?? null,
  }
}

function names(list: any[], market: string): string[] {
  return list
    .filter((b) => b?.market === market)
    .flatMap((b) => (Array.isArray(b?.names) ? b.names : []))
    .map((n: unknown) => String(n).trim())
    .filter(Boolean)
}

export function parseScoreboard(json: any, league: LeagueDef): Game[] {
  const games: Game[] = []
  for (const ev of Array.isArray(json?.events) ? json.events : []) {
    const comp = ev?.competitions?.[0]
    // Preseason (September hockey, spring training) doesn't keep buyers home.
    if (!comp || ev?.season?.type === 1 || SKIP_STATUSES.has(ev?.status?.type?.name)) continue
    const competitors = Array.isArray(comp.competitors) ? comp.competitors : []
    const homeRaw = competitors.find((c: any) => c?.homeAway === 'home')
    const awayRaw = competitors.find((c: any) => c?.homeAway === 'away')
    if (!homeRaw || !awayRaw || !ev.date || Number.isNaN(Date.parse(ev.date))) continue

    const home = side(homeRaw, league)
    const away = side(awayRaw, league)
    const neutral = !!comp.neutralSite
    const postseason = ev?.season?.type === 3
    const notes: string[] = (Array.isArray(comp.notes) ? comp.notes : []).map((n: any) =>
      String(n?.headline ?? '')
    )
    const ncaaTournament = postseason && notes.some((h) => /NCAA/i.test(h))
    if (league.onlyWhenItMatters && !home.rank && !away.rank && !ncaaTournament) continue

    const location = venueLocation(comp.venue?.address, comp.venue?.fullName)
    const broadcasts = Array.isArray(comp.broadcasts) ? comp.broadcasts : []
    games.push({
      id: String(ev.id),
      league,
      startIso: ev.date,
      timeKnown:
        comp.timeValid !== false && !/\b(TBD|TBA)\b/i.test(String(ev?.status?.type?.shortDetail ?? '')),
      home,
      away,
      neutral,
      city: location.city,
      // No venue state on a true home game: it's in the home team's state.
      venueState: location.state ?? (neutral ? null : home.homeState),
      broadcasts: {
        national: names(broadcasts, 'national'),
        home: names(broadcasts, 'home'),
        away: names(broadcasts, 'away'),
      },
      postseason,
    })
  }
  return games
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      if (attempt >= 3) throw new Error(`${url} failed: ${e instanceof Error ? e.message : String(e)}`)
      await sleep(1000 * attempt)
    }
  }
}

// Every covered league's games for one Saturday + Sunday (ESPN groups games
// by Eastern date, so late West Coast games still land on the right day).
// Throws if ANY league can't be read: a half-empty lineup is worse than none.
export async function fetchWeekendGames(
  saturdayYmd: string,
  sundayYmd: string,
  fetchImpl: typeof fetch = fetch
): Promise<Game[]> {
  const dates = `${saturdayYmd.replaceAll('-', '')}-${sundayYmd.replaceAll('-', '')}`
  const perLeague = await Promise.all(
    LEAGUES.map(async (league) => {
      const params = new URLSearchParams({ dates, limit: '1000' })
      if (league.group) params.set('groups', league.group)
      const json = await fetchJson(`${ESPN_BASE}/${league.key}/scoreboard?${params}`, fetchImpl)
      if (!Array.isArray(json?.events)) throw new Error(`${league.key}: unexpected response shape`)
      return parseScoreboard(json, league)
    })
  )
  const seen = new Set<string>()
  return perLeague.flat().filter((g) => {
    const key = `${g.league.key}:${g.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
