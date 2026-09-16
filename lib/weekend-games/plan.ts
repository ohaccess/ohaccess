import { US_STATES } from '../hardware-offer'
import type { Game, TeamSide } from './espn'
import { SPORT_WORDS } from './leagues'
import { addDays, dateLabel, hourLabel, timeLabel, timeZoneLabel, zonedParts } from './time'
import { STATE_METRO, sunTimes, type LatLng } from './sun'

// Turns a day of games into what one state sees: the game list, the 10 AM
// to 6 PM game meter, the sweet spot, the "Big one" and the headline. Used
// by the Wednesday email (Saturday + Sunday) and the /planner page (any
// day). Pure, so every rule is unit-tested.

export const METER_START_HOUR = 10
export const METER_END_HOUR = 18 // games starting at or after this fold into one line
export const MAX_DAYTIME_ROWS = 10
export const BIG_GAME_MIN_SCORE = 60

// Channels most households get, which makes a college game a bigger deal.
const BIG_NETWORKS = new Set(['ABC', 'CBS', 'NBC', 'FOX', 'ESPN'])
// Out-of-market subscriptions, not somewhere a buyer would watch.
const STREAMING_PASSES = new Set(['MLB.TV', 'NBA League Pass', 'NHL.TV', 'MLS Season Pass', 'WNBA League Pass'])

export type PlannedGame = {
  game: Game
  // here = played in the state; away = a state team playing elsewhere;
  // national = no state tie, but the whole country is watching.
  involvement: 'here' | 'away' | 'national'
  stateTeam: TeamSide
  otherTeam: TeamSide
  startMinute: number // minutes after local midnight
  timeText: string
  matchup: string
  detail: string
  tv: string | null
  score: number
}

export type DayPlan = {
  ymd: string
  weekdayName: string
  dateText: string
  meter: number[] // games overlapping each hour, 10 AM to 5 PM
  sweetSpot: { label: string; text: string }
  goBold: string | null
  headline: string
  bigGame: PlannedGame | null
  rows: PlannedGame[]
  moreDaytime: number
  afterHours: PlannedGame[]
  tba: PlannedGame[] // on the schedule, start time not announced
  expected: PlannedGame[] // hand-kept placeholders: usual dates, nothing announced
  total: number
  // Local wall-clock times; null in polar day/night.
  sun: { sunriseText: string; sunsetText: string; sunsetMinute: number } | null
  // Meter hours (index) that are dark by the time they end: none in
  // summer, the last one or two from November to February.
  duskHours: number[]
}

export type WeekendPlan = {
  stateCode: string
  stateName: string
  timeZone: string
  timeZoneText: string
  saturday: DayPlan
  sunday: DayPlan
  totalGames: number
  bigGame: PlannedGame | null
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function weekdayName(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return WEEKDAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

function pickTv(g: Game, stateTeam: TeamSide): string | null {
  const national = g.broadcasts.national.filter((n) => !STREAMING_PASSES.has(n))
  if (national.length) return national[0]
  const local = stateTeam === g.home ? g.broadcasts.home : g.broadcasts.away
  return local.find((n) => !STREAMING_PASSES.has(n)) ?? null
}

// "the Aggies", "the Cowboys", "FC Dallas", "Masters Tournament, final round"
export function teamPhrase(p: PlannedGame): string {
  if (p.game.kind !== 'game') return p.game.name ?? 'the game'
  if (p.game.league.sport === 'soccer') return p.stateTeam.short
  return `the ${p.game.league.college ? p.stateTeam.nickname : p.stateTeam.short}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function planGame(
  g: Game,
  state: string,
  startMinute: number,
  timeText: string,
  includeNational: boolean
): PlannedGame | null {
  // The Wednesday email keeps to real matchups with a state tie; placeholders
  // and national events are the planner's.
  if (!includeNational && g.kind !== 'game') return null
  const homeFrom = g.kind === 'game' && g.home.homeState === state
  const awayFrom = g.kind === 'game' && g.away.homeState === state
  let involvement: PlannedGame['involvement']
  if (g.venueState === state) involvement = 'here'
  else if (homeFrom || awayFrom) involvement = 'away'
  else if (g.national && includeNational) involvement = 'national'
  else return null

  const stateTeam = homeFrom ? g.home : awayFrom ? g.away : g.home
  const otherTeam = stateTeam === g.home ? g.away : g.home
  const tv = pickTv(g, stateTeam)

  let score = g.importance + (involvement === 'here' ? 20 : 0)
  const bestRank = Math.min(g.home.rank ?? 99, g.away.rank ?? 99)
  if (g.league.college && bestRank <= 25) score += 26 - bestRank
  if (g.league.college && tv && BIG_NETWORKS.has(tv)) score += 10
  if (g.postseason) score += 40

  const label = (t: TeamSide) => (g.league.college && t.rank ? `#${t.rank} ${t.short}` : t.short)
  const matchup =
    g.kind === 'game'
      ? g.neutral
        ? `${label(g.away)} vs ${label(g.home)}`
        : `${label(g.away)} at ${label(g.home)}`
      : g.name ?? 'Game'

  let where: string | null = null
  if (involvement === 'here') where = g.city
  else if (g.kind === 'game' && involvement === 'away') where = g.neutral && g.city ? `📺 In ${g.city}` : '📺 Away game'
  else if (g.city) where = `📺 In ${g.city}`

  const detail = [
    g.kind === 'placeholder' ? (g.expected ? 'Details TBA' : 'Teams TBA') : null,
    g.kind === 'game' && g.postseason ? g.name : null,
    where,
    tv,
  ]
    .filter(Boolean)
    .join(' · ')

  return { game: g, involvement, stateTeam, otherTeam, startMinute, timeText, matchup, detail, tv, score }
}

function endMinute(p: PlannedGame): number {
  return p.startMinute + p.game.league.durationMin
}

function overlapsHour(p: PlannedGame, hour: number): boolean {
  return p.startMinute < (hour + 1) * 60 && endMinute(p) > hour * 60
}

// Longest run of hours whose count equals `value`; earliest wins a tie.
function longestRun(meter: number[], value: number): { start: number; length: number } {
  let best = { start: 0, length: 0 }
  for (let i = 0; i < meter.length; ) {
    if (meter[i] !== value) {
      i++
      continue
    }
    let j = i
    while (j < meter.length && meter[j] === value) j++
    if (j - i > best.length) best = { start: i, length: j - i }
    i = j
  }
  return best
}

export function sweetSpot(meter: number[]): { label: string; text: string } {
  if (meter.every((c) => c === 0)) {
    return { label: 'Sweet spot', text: `any time from ${hourLabel(METER_START_HOUR)} to ${hourLabel(METER_END_HOUR)}` }
  }
  const clear = longestRun(meter, 0)
  const run = clear.length ? clear : longestRun(meter, Math.min(...meter))
  const text = `${hourLabel(METER_START_HOUR + run.start)} to ${hourLabel(METER_START_HOUR + run.start + run.length)}`
  return clear.length ? { label: 'Sweet spot', text } : { label: 'Lightest stretch', text }
}

function headline(day: { weekdayName: string; total: number; meter: number[]; bigGame: PlannedGame | null }): string {
  const big = day.bigGame
  if (day.total === 0) return 'Coast is clear. Not a single game on the schedule.'
  if (!big) {
    if (day.total === 1) return 'A light one: just one game, nothing huge.'
    if (day.total === 2) return 'A light one: just two games, nothing huge.'
    return 'Plenty on, but no blockbusters.'
  }
  const team = teamPhrase(big)
  // A team "kicks off"; an event just "starts".
  const verb = big.game.kind === 'game' ? SPORT_WORDS[big.game.league.sport].verb : 'starts'
  if (big.game.league.key === 'football/nfl' && big.game.kind === 'game') {
    return `${day.weekdayName} belongs to ${team}. Kickoff ${big.timeText}${big.tv ? ` on ${big.tv}` : ''}.`
  }
  const hoursBefore = day.meter.slice(0, Math.max(0, Math.floor(big.startMinute / 60) - METER_START_HOUR))
  if (hoursBefore.length >= 2 && hoursBefore.every((c) => c === 0)) {
    return `Wide open until ${team} ${verb} at ${big.timeText}.`
  }
  if (hoursBefore.length >= 2 && hoursBefore.every((c) => c <= 1)) {
    return `Mostly open until ${team} ${verb} at ${big.timeText}.`
  }
  return `${capitalize(team)} ${verb} at ${big.timeText}. That's the one to plan around.`
}

function byStart(a: PlannedGame, b: PlannedGame): number {
  return a.startMinute - b.startMinute || b.score - a.score
}

function biggest(games: PlannedGame[]): PlannedGame | null {
  return (
    [...games].sort((a, b) => b.score - a.score || b.startMinute - a.startMinute)[0] ?? null
  )
}

type SunAt = { at: LatLng; timeZone: string }

// Where to compute sunrise/sunset: the agent's latest open house if its
// coordinates are known, else the state's largest metro.
function sunAtFor(state: string, timeZone: string, location?: LatLng | null): SunAt {
  return { at: location ?? STATE_METRO[state] ?? { lat: 39.83, lng: -98.58 }, timeZone }
}

function buildDay(ymd: string, planned: PlannedGame[], sunAt: SunAt): DayPlan {
  const times = sunTimes(ymd, sunAt.at, sunAt.timeZone)
  const sun = times
    ? {
        sunriseText: timeLabel(Math.floor(times.sunrise / 60), times.sunrise % 60),
        sunsetText: timeLabel(Math.floor(times.sunset / 60), times.sunset % 60),
        sunsetMinute: times.sunset,
      }
    : null
  const duskHours: number[] = []
  if (sun) {
    for (let hour = METER_START_HOUR; hour < METER_END_HOUR; hour++) {
      if ((hour + 1) * 60 > sun.sunsetMinute) duskHours.push(hour - METER_START_HOUR)
    }
  }

  const expected = planned.filter((p) => p.game.expected)
  const timed = planned.filter((p) => p.game.timeKnown && !p.game.expected)
  const tba = planned.filter((p) => !p.game.timeKnown && !p.game.expected)

  const meter: number[] = []
  for (let hour = METER_START_HOUR; hour < METER_END_HOUR; hour++) {
    meter.push(timed.filter((p) => overlapsHour(p, hour)).length)
  }

  // Evening games don't compete with open houses, so they're never the Big one.
  const bigGame = biggest(
    timed.filter((p) => p.score >= BIG_GAME_MIN_SCORE && p.startMinute < METER_END_HOUR * 60)
  )

  const daytime = timed.filter((p) => p.startMinute < METER_END_HOUR * 60).sort(byStart)
  let rows = daytime
  if (daytime.length > MAX_DAYTIME_ROWS) {
    const keep = new Set([...daytime].sort((a, b) => b.score - a.score).slice(0, MAX_DAYTIME_ROWS))
    rows = daytime.filter((p) => keep.has(p))
  }

  const bigInMeter =
    bigGame && bigGame.startMinute < METER_END_HOUR * 60 && endMinute(bigGame) > METER_START_HOUR * 60
  const boldName = bigGame
    ? bigGame.game.kind === 'game'
      ? `${bigGame.stateTeam.short} vs ${bigGame.otherTeam.short}`
      : bigGame.game.name ?? 'the big one'
    : ''

  const name = weekdayName(ymd)
  const day = { weekdayName: name, total: planned.length, meter, bigGame }
  return {
    ymd,
    weekdayName: name,
    dateText: dateLabel(ymd),
    meter,
    sweetSpot: sweetSpot(meter),
    goBold: bigInMeter ? `Or Go Bold during ${boldName}.` : null,
    headline: headline(day),
    bigGame,
    rows,
    moreDaytime: daytime.length - rows.length,
    afterHours: timed.filter((p) => p.startMinute >= METER_END_HOUR * 60).sort(byStart),
    tba,
    expected,
    total: planned.length,
    sun,
    duskHours,
  }
}

// Which local day a game lands on, and when. Null for a past-midnight
// tip-off (it belongs to the night before, not the morning).
function localSlot(g: Game, timeZone: string): { day: string; startMinute: number; timeText: string } | null {
  const start = new Date(g.startIso)
  const local = zonedParts(start, timeZone)
  // An unannounced kickoff carries a placeholder midnight-Eastern time, so
  // it's bucketed by its Eastern date instead.
  const day = g.timeKnown ? local.ymd : zonedParts(start, 'America/New_York').ymd
  if (g.timeKnown && local.hour < 6) return null
  const label = timeLabel(local.hour, local.minute)
  return {
    day,
    startMinute: local.hour * 60 + local.minute,
    timeText: !g.timeKnown ? 'Time TBA' : g.timeApprox ? `~${label}` : label,
  }
}

function planDays(
  games: Game[],
  state: string,
  timeZone: string,
  days: string[],
  includeNational: boolean
): Record<string, PlannedGame[]> {
  const byDay: Record<string, PlannedGame[]> = Object.fromEntries(days.map((d) => [d, []]))
  for (const g of games) {
    const slot = localSlot(g, timeZone)
    if (!slot || !byDay[slot.day]) continue
    const planned = planGame(g, state, slot.startMinute, slot.timeText, includeNational)
    if (planned) byDay[slot.day].push(planned)
  }
  return byDay
}

// One day for the planner: every game with a state tie plus the national
// events and playoff placeholders.
export function buildDayPlan(o: {
  games: Game[]
  state: string
  timeZone: string
  ymd: string
  includeNational?: boolean
  location?: LatLng | null
}): DayPlan {
  const byDay = planDays(o.games, o.state, o.timeZone, [o.ymd], o.includeNational ?? true)
  return buildDay(o.ymd, byDay[o.ymd], sunAtFor(o.state, o.timeZone, o.location))
}

// What a calendar cell needs to know about a day.
export type DaySummary = { heat: number; big: boolean; tba: number; expected: number; total: number }

export function daySummary(plan: DayPlan): DaySummary {
  const bigInMeter =
    !!plan.bigGame && plan.bigGame.startMinute < METER_END_HOUR * 60 && endMinute(plan.bigGame) > METER_START_HOUR * 60
  return {
    heat: bigInMeter ? 3 : Math.min(3, Math.max(0, ...plan.meter)),
    big: !!plan.bigGame,
    tba: plan.tba.length,
    expected: plan.expected.length,
    total: plan.total,
  }
}

export function buildWeekendPlan(o: {
  games: Game[]
  state: string
  timeZone: string
  saturdayYmd: string
  // Where to compute sunrise/sunset: the agent's latest open house if its
  // coordinates are known, else the state's largest metro.
  location?: LatLng | null
}): WeekendPlan {
  const sunAt = sunAtFor(o.state, o.timeZone, o.location)
  const sundayYmd = addDays(o.saturdayYmd, 1)
  const byDay = planDays(o.games, o.state, o.timeZone, [o.saturdayYmd, sundayYmd], false)

  const saturday = buildDay(o.saturdayYmd, byDay[o.saturdayYmd], sunAt)
  const sunday = buildDay(sundayYmd, byDay[sundayYmd], sunAt)
  const bigGame =
    [saturday.bigGame, sunday.bigGame]
      .filter((p): p is PlannedGame => !!p)
      .sort((a, b) => b.score - a.score)[0] ?? null

  return {
    stateCode: o.state,
    stateName: US_STATES[o.state] ?? o.state,
    timeZone: o.timeZone,
    timeZoneText: timeZoneLabel(o.timeZone, new Date(`${o.saturdayYmd}T12:00:00Z`)),
    saturday,
    sunday,
    totalGames: saturday.total + sunday.total,
    bigGame,
  }
}
