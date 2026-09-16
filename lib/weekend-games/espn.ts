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

export type WeekendGames = {
  games: Game[]
  // Optional leagues ESPN couldn't serve this time (see LeagueDef.optional).
  skippedLeagues: string[]
}

// ESPN's feed is unofficial and its query handling shifts under us. Seen on
// 2026-09-16, three days after launch: the two-day range form
// (dates=20260919-20260920) began returning HTTP 400 for every league, and
// limit=1000 began silently returning only 25 games, while a single-day
// request with no limit, or a limit up to 500, still returned everything
// (71 college football games; 139 on a January basketball day). So every
// league-day is requested once per form below and the results are merged by
// event id: a change to one form can't quietly shrink the lineup, and the
// day only fails if every form fails.
const REQUEST_FORMS: Record<string, string>[] = [{}, { limit: '500' }]

async function fetchLeagueDay(league: LeagueDef, ymd: string, fetchImpl: typeof fetch): Promise<Game[]> {
  const errors: string[] = []
  const results = await Promise.all(
    REQUEST_FORMS.map(async (extra) => {
      const params = new URLSearchParams({ dates: ymd.replaceAll('-', ''), ...extra })
      if (league.group) params.set('groups', league.group)
      try {
        const json = await fetchJson(`${ESPN_BASE}/${league.key}/scoreboard?${params}`, fetchImpl)
        if (!Array.isArray(json?.events)) throw new Error(`${league.key} ${ymd}: unexpected response shape`)
        return parseScoreboard(json, league)
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
        return null
      }
    })
  )
  const ok = results.filter((r): r is Game[] => r !== null)
  if (!ok.length) throw new Error(errors.join('; '))
  if (errors.length) console.warn('weekend-games: one request form failed', league.key, ymd, errors)
  return ok.flat()
}

// Every covered league's games for one Saturday + Sunday, requested a day at
// a time (ESPN groups games by Eastern date, so late West Coast games still
// land on the right day).
//
// A required league that can't be read throws: a lineup missing the NFL or
// college football is worse than none. An optional league that can't be
// read is left out and named in skippedLeagues so the cron can warn the team.
export async function fetchWeekendGames(
  saturdayYmd: string,
  sundayYmd: string,
  fetchImpl: typeof fetch = fetch
): Promise<WeekendGames> {
  const skippedLeagues: string[] = []
  const perLeague = await Promise.all(
    LEAGUES.map(async (league) => {
      try {
        const perDay = await Promise.all(
          [saturdayYmd, sundayYmd].map((ymd) => fetchLeagueDay(league, ymd, fetchImpl))
        )
        return perDay.flat()
      } catch (e) {
        if (!league.optional) throw e
        console.error('weekend-games: leaving out optional league', league.key, e)
        skippedLeagues.push(league.key)
        return []
      }
    })
  )
  const seen = new Set<string>()
  const games = perLeague.flat().filter((g) => {
    const key = `${g.league.key}:${g.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { games, skippedLeagues }
}
