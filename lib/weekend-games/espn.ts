/* eslint-disable @typescript-eslint/no-explicit-any -- ESPN's feed is untyped JSON; every field is checked as it's read */
import teamStatesJson from './team-states.json'
import { normalizeStateCode } from '../hardware-offer'
import { EMAIL_LEAGUES, eventImportance, isGolfMajor, type LeagueDef } from './leagues'
import { addDays, zonedParts } from './time'

// Reads ESPN's public scoreboard feed (no key, no cost, but unofficial, so
// the cron treats any failure or odd shape as "don't send this week") and
// normalizes each game into the few facts the weekend-games email and the
// planner need.

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports'
const ET = 'America/New_York'

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
  // game = two named teams; placeholder = a playoff slot whose teams aren't
  // decided yet ("TBD at TBD", shown as "teams TBA"); event = a tournament,
  // race or fight card with no teams at all.
  kind: 'game' | 'placeholder' | 'event'
  // Round or event name: "Wild Card Playoffs", "Masters Tournament, final
  // round". Null for an ordinary game.
  name: string | null
  importance: number // base score for the "Big one" pick
  startIso: string
  timeKnown: boolean // false = kickoff not announced yet (TBA)
  timeApprox: boolean // true = a typical TV window, not a published start
  home: TeamSide
  away: TeamSide
  neutral: boolean
  city: string | null
  venueState: string | null
  broadcasts: { national: string[]; home: string[]; away: string[] }
  postseason: boolean
  // Shown to every state, not just the teams' own: playoff placeholders,
  // the Super Bowl, the Masters.
  national: boolean
  // A hand-kept placeholder (lib/planner/curated.ts): the event exists and
  // these are its usual dates, but nothing is announced yet.
  expected?: boolean
}

export const NO_TEAM: TeamSide = { id: '', short: '', nickname: '', rank: null, homeState: null }

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

function allNames(list: any[]): string[] {
  return [...new Set(list.flatMap((b) => (Array.isArray(b?.names) ? b.names : [])).map((n: unknown) => String(n).trim()).filter(Boolean))]
}

const isTbd = (t: TeamSide) => !t.id || /^TBD$/i.test(t.short)

// Games the whole country watches, whichever teams are in them.
function nationalGame(league: LeagueDef, postseason: boolean, notes: string[]): boolean {
  if (!postseason) return false
  const text = notes.join(' ')
  if (league.key === 'football/nfl') return true
  if (league.key === 'football/college-football') return /Playoff|National Championship/i.test(text)
  if (league.key === 'baseball/mlb') return /World Series/i.test(text)
  if (league.key === 'basketball/nba') return /NBA Finals/i.test(text)
  if (league.key === 'hockey/nhl') return /Stanley Cup Final/i.test(text)
  return false
}

export function parseScoreboard(json: any, league: LeagueDef): Game[] {
  if (league.kind === 'event') return parseEvents(json, league)
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
    const notes: string[] = (Array.isArray(comp.notes) ? comp.notes : [])
      .map((n: any) => String(n?.headline ?? '').trim())
      .filter(Boolean)
    const ncaaTournament = postseason && notes.some((h) => /NCAA/i.test(h))
    if (league.onlyWhenItMatters && !home.rank && !away.rank && !ncaaTournament) continue

    // "TBD at TBD": a playoff slot on the calendar before the matchup is
    // set. Kept (as a placeholder shown to every state) only in the
    // postseason; a regular-season TBD is a scheduling hole, not a game.
    const placeholder = isTbd(home) || isTbd(away)
    if (placeholder && !postseason) continue

    const location = venueLocation(comp.venue?.address, comp.venue?.fullName)
    const broadcasts = Array.isArray(comp.broadcasts) ? comp.broadcasts : []
    games.push({
      id: String(ev.id),
      league,
      kind: placeholder ? 'placeholder' : 'game',
      name: notes[0] ?? (placeholder ? 'Playoff game' : null),
      importance: league.importance,
      startIso: ev.date,
      timeKnown:
        comp.timeValid !== false && !/\b(TBD|TBA)\b/i.test(String(ev?.status?.type?.shortDetail ?? '')),
      timeApprox: false,
      home,
      away,
      neutral,
      city: location.city,
      // No venue state on a true home game: it's in the home team's state.
      venueState: location.state ?? (neutral || placeholder ? null : home.homeState),
      broadcasts: {
        national: names(broadcasts, 'national'),
        home: names(broadcasts, 'home'),
        away: names(broadcasts, 'away'),
      },
      postseason,
      national: placeholder || nationalGame(league, postseason, notes),
    })
  }
  return games
}

// ── Event sports (golf, racing, UFC, tennis) ───────────────────────────────

// Local wall-clock time in a zone → ISO instant.
export function zonedTimeToIso(ymd: string, hour: number, minute: number, timeZone: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, hour, minute)
  const p = zonedParts(new Date(guess), timeZone)
  const [py, pm, pd] = p.ymd.split('-').map(Number)
  const offset = Date.UTC(py, pm - 1, pd, p.hour, p.minute) - guess
  return new Date(guess - offset).toISOString()
}

function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function etDay(iso: string): string {
  return zonedParts(new Date(iso), ET).ymd
}

// Days from the tournament's first ET date to its last, inclusive.
function spanDays(ev: any): string[] {
  const start = etDay(ev.date)
  const end = ev.endDate && !Number.isNaN(Date.parse(ev.endDate)) ? etDay(ev.endDate) : start
  const days: string[] = []
  for (let d = start; d <= end && days.length < 31; d = addDays(d, 1)) days.push(d)
  return days
}

// Finals of the four majors, ET. Women's final Saturday, men's Sunday.
const TENNIS_FINALS: [RegExp, { hour: number; minute: number }][] = [
  [/US Open/i, { hour: 14, minute: 0 }],
  [/Wimbledon/i, { hour: 11, minute: 0 }],
  [/French Open|Roland Garros/i, { hour: 9, minute: 0 }],
  [/Australian Open/i, { hour: 3, minute: 30 }],
]

function eventBase(ev: any, league: LeagueDef, o: {
  id: string
  name: string
  importance: number
  startIso: string
  timeKnown: boolean
  timeApprox: boolean
  venue?: any
  broadcasts?: any[]
}): Game {
  const location = venueLocation(o.venue?.address, o.venue?.fullName)
  return {
    id: o.id,
    league,
    kind: 'event',
    name: o.name,
    importance: o.importance,
    startIso: o.startIso,
    timeKnown: o.timeKnown,
    timeApprox: o.timeApprox,
    home: NO_TEAM,
    away: NO_TEAM,
    neutral: true,
    city: location.city,
    venueState: location.state,
    broadcasts: { national: allNames(o.broadcasts ?? []), home: [], away: [] },
    postseason: ev?.season?.type === 3,
    national: true,
  }
}

export function parseEvents(json: any, league: LeagueDef): Game[] {
  const games: Game[] = []
  for (const ev of Array.isArray(json?.events) ? json.events : []) {
    if (ev?.season?.type === 1 || SKIP_STATUSES.has(ev?.status?.type?.name)) continue
    if (!ev?.date || Number.isNaN(Date.parse(ev.date))) continue
    const name = String(ev.shortName || ev.name || '').trim()
    if (!name) continue
    const importance = eventImportance(league, String(ev.name || name))
    if (importance === null) continue
    const comps: any[] = Array.isArray(ev.competitions) ? ev.competitions : []
    const id = String(ev.id)

    if (league.key === 'golf/pga') {
      // One row per tournament day. Majors list all four rounds; a regular
      // stop only its weekend. Start times are the usual TV windows.
      const major = isGolfMajor(String(ev.name || name))
      const days = spanDays(ev)
      days.forEach((ymd, i) => {
        const weekend = weekdayOf(ymd) === 0 || weekdayOf(ymd) === 6
        if (!major && !weekend) return
        const round = i === days.length - 1 ? 'final round' : `round ${i + 1}`
        games.push(
          eventBase(ev, league, {
            id: `${id}:${ymd}`,
            name: `${name}, ${round}`,
            importance: i === days.length - 1 ? importance : Math.max(10, importance - 15),
            startIso: zonedTimeToIso(ymd, major ? (weekend ? 14 : 15) : 13, 0, ET),
            timeKnown: true,
            timeApprox: true,
            broadcasts: comps[0]?.broadcasts,
          })
        )
      })
      continue
    }

    if (league.key === 'tennis/atp') {
      // Only the finals weekend of a major matters to an open house.
      const days = spanDays(ev)
      if (days.length < 2) continue
      const finals = TENNIS_FINALS.find(([re]) => re.test(name))?.[1]
      if (!finals) continue
      const [sat, sun] = [days[days.length - 2], days[days.length - 1]]
      const rows: [string, string, number][] = [
        [sat, "women's final", league.importance],
        [sun, "men's final", importance],
      ]
      for (const [ymd, label, imp] of rows) {
        games.push(
          eventBase(ev, league, {
            id: `${id}:${ymd}`,
            name: `${name} ${label}`,
            importance: imp,
            startIso: zonedTimeToIso(ymd, finals.hour, finals.minute, ET),
            timeKnown: true,
            timeApprox: true,
          })
        )
      }
      continue
    }

    // Racing and UFC: one event, one start time. F1 weekends list practice
    // and qualifying too; only the race counts.
    let comp = comps[0]
    if (league.key === 'racing/f1') {
      comp = comps.find((c) => /race/i.test(String(c?.type?.abbreviation ?? ''))) ?? comps[comps.length - 1]
    }
    const startIso = String(comp?.date || ev.date)
    if (Number.isNaN(Date.parse(startIso))) continue
    games.push(
      eventBase(ev, league, {
        id,
        name,
        importance,
        startIso,
        timeKnown: comp?.timeValid !== false && !/\b(TBD|TBA)\b/i.test(String(ev?.status?.type?.shortDetail ?? '')),
        timeApprox: false,
        venue: comp?.venue,
        broadcasts: comp?.broadcasts,
      })
    )
  }
  return games
}

// ── Fetching ───────────────────────────────────────────────────────────────

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

function scoreboardUrl(league: LeagueDef, params: URLSearchParams): string {
  if (league.group) params.set('groups', league.group)
  return `${ESPN_BASE}/${league.key}/scoreboard?${params}`
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
      try {
        const json = await fetchJson(scoreboardUrl(league, params), fetchImpl)
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

function dedupe(games: Game[]): Game[] {
  const seen = new Set<string>()
  return games.filter((g) => {
    const key = `${g.league.key}:${g.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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
    EMAIL_LEAGUES.map(async (league) => {
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
  return { games: dedupe(perLeague.flat()), skippedLeagues }
}

// ── Season-long reads for the planner's weekly refresh ─────────────────────

// One day, one request (the limit=500 form first, the plain form if that
// fails). Cheaper than fetchLeagueDay's two-way cross-check, which the
// refresh doesn't need: it re-reads the near term every week anyway.
export async function fetchLeagueDayOnce(league: LeagueDef, ymd: string, fetchImpl: typeof fetch): Promise<Game[]> {
  const errors: string[] = []
  for (const extra of [{ limit: '500' }, {}]) {
    const params = new URLSearchParams({ dates: ymd.replaceAll('-', ''), ...extra } as Record<string, string>)
    try {
      const json = await fetchJson(scoreboardUrl(league, params), fetchImpl)
      if (!Array.isArray(json?.events)) throw new Error(`${league.key} ${ymd}: unexpected response shape`)
      return parseScoreboard(json, league)
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }
  throw new Error(errors.join('; '))
}

export const MONTH_CAP = 500

// A whole month in one request. Null when ESPN's 500-game cap was hit, so
// the caller re-reads that month a day at a time instead of trusting a
// silently shortened list.
export async function fetchLeagueMonth(league: LeagueDef, yyyymm: string, fetchImpl: typeof fetch): Promise<Game[] | null> {
  const params = new URLSearchParams({ dates: yyyymm.replace('-', ''), limit: String(MONTH_CAP) })
  const json = await fetchJson(scoreboardUrl(league, params), fetchImpl)
  if (!Array.isArray(json?.events)) throw new Error(`${league.key} ${yyyymm}: unexpected response shape`)
  if (json.events.length >= MONTH_CAP) return null
  return parseScoreboard(json, league)
}

export function daysBetween(fromYmd: string, toYmd: string): string[] {
  const days: string[] = []
  for (let d = fromYmd; d <= toYmd; d = addDays(d, 1)) days.push(d)
  return days
}

export function monthsBetween(fromYmd: string, toYmd: string): string[] {
  return [...new Set(daysBetween(fromYmd, toYmd).map((d) => d.slice(0, 7)))]
}

export async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
  return out
}

// Everything ESPN has for one league between two dates: a request per month
// (falling back to a request per day when a month hits the cap), plus the
// first `nearDays` days re-read a day at a time and merged in, so a change
// in ESPN's month handling can't quietly empty next weekend. Throws if any
// request fails after retries; the caller keeps last week's rows then.
export async function fetchLeagueRange(
  league: LeagueDef,
  fromYmd: string,
  toYmd: string,
  fetchImpl: typeof fetch = fetch,
  o: { nearDays?: number; concurrency?: number } = {}
): Promise<Game[]> {
  const concurrency = o.concurrency ?? 6
  const days = daysBetween(fromYmd, toYmd)
  const collected: Game[] = []
  if (league.fetch === 'day') {
    for (const batch of await mapPool(days, concurrency, (d) => fetchLeagueDayOnce(league, d, fetchImpl))) collected.push(...batch)
  } else {
    const months = monthsBetween(fromYmd, toYmd)
    const perMonth = await mapPool(months, concurrency, (m) => fetchLeagueMonth(league, m, fetchImpl))
    for (let i = 0; i < months.length; i++) {
      const got = perMonth[i]
      if (got) {
        collected.push(...got)
        continue
      }
      const monthDays = days.filter((d) => d.startsWith(months[i]))
      for (const batch of await mapPool(monthDays, concurrency, (d) => fetchLeagueDayOnce(league, d, fetchImpl))) collected.push(...batch)
    }
    const near = days.slice(0, o.nearDays ?? 14)
    for (const batch of await mapPool(near, concurrency, (d) => fetchLeagueDayOnce(league, d, fetchImpl))) collected.push(...batch)
  }
  return dedupe(collected)
}
