import { describe, it, expect } from 'vitest'
import {
  NO_TEAM,
  fetchLeagueRange,
  parseEvents,
  parseScoreboard,
  zonedTimeToIso,
  type Game,
} from '../lib/weekend-games/espn'
import { EMAIL_LEAGUES, LEAGUES, eventImportance, leagueByKey } from '../lib/weekend-games/leagues'
import { buildDayPlan, buildWeekendPlan, daySummary, weekdayName } from '../lib/weekend-games/plan'
import { CURATED, curatedGames, withoutSuperseded } from '../lib/planner/curated'
import { fromRow, fromWire, toRow, toWire } from '../lib/planner/rows'
import { normalizeZip, parseZipGeocode } from '../lib/planner/zip'

const NFL = leagueByKey('football/nfl')!
const MLB = leagueByKey('baseball/mlb')!
const PGA = leagueByKey('golf/pga')!
const F1 = leagueByKey('racing/f1')!
const UFC = leagueByKey('mma/ufc')!
const ATP = leagueByKey('tennis/atp')!
const MCBB = leagueByKey('basketball/mens-college-basketball')!

function tbdEvent(o: { id?: string; date?: string; note?: string; seasonType?: number; venue?: { city: string; state: string }; timeValid?: boolean }) {
  return {
    id: o.id ?? '9',
    name: 'TBD at TBD',
    date: o.date ?? '2027-01-17T05:00Z',
    season: { type: o.seasonType ?? 3 },
    status: { type: { name: 'STATUS_SCHEDULED', shortDetail: o.timeValid === false ? 'TBD' : '1/17 - 3:00 PM EST' } },
    competitions: [
      {
        timeValid: o.timeValid ?? true,
        venue: o.venue ? { fullName: 'Stadium', address: o.venue } : undefined,
        notes: o.note ? [{ headline: o.note }] : [],
        broadcasts: [{ market: 'national', names: ['CBS'] }],
        competitors: [
          { homeAway: 'home', team: { id: '', shortDisplayName: 'TBD', name: 'TBD' } },
          { homeAway: 'away', team: { id: '', shortDisplayName: 'TBD', name: 'TBD' } },
        ],
      },
    ],
  }
}

function game(o: Partial<Game> & { start: string; league?: Game['league'] }): Game {
  const { start, ...rest } = o
  const league = o.league ?? NFL
  return {
    id: start,
    league,
    kind: 'game',
    name: null,
    importance: league.importance,
    startIso: start,
    timeKnown: true,
    timeApprox: false,
    home: { id: '1', short: 'Cowboys', nickname: 'Cowboys', rank: null, homeState: 'TX' },
    away: { id: '2', short: 'Eagles', nickname: 'Eagles', rank: null, homeState: 'PA' },
    neutral: false,
    city: 'Arlington',
    venueState: 'TX',
    broadcasts: { national: ['FOX'], home: [], away: [] },
    postseason: false,
    national: false,
    ...rest,
  }
}

describe('leagues', () => {
  it('keeps the email lineup separate from the planner-only event sports', () => {
    expect(EMAIL_LEAGUES.every((l) => !l.plannerOnly)).toBe(true)
    expect(EMAIL_LEAGUES.map((l) => l.key)).not.toContain('golf/pga')
    expect(LEAGUES.map((l) => l.key)).toContain('golf/pga')
  })

  it('rates events by name and leaves out the ones nobody plans around', () => {
    expect(eventImportance(PGA, 'Masters Tournament')).toBe(70)
    expect(eventImportance(PGA, 'Bank of Utah Championship')).toBe(12)
    expect(eventImportance(UFC, 'UFC 332: Silva vs. Wang')).toBe(40)
    expect(eventImportance(UFC, "Dana White's Contender Series: Season 10, Week 9")).toBeNull()
    expect(eventImportance(ATP, 'US Open')).toBe(40)
    expect(eventImportance(ATP, 'Cincinnati Open')).toBeNull()
    expect(eventImportance(leagueByKey('racing/irl')!, 'Indianapolis 500')).toBe(75)
  })
})

describe('parseScoreboard placeholders', () => {
  it('keeps a postseason "TBD at TBD" as a national placeholder, drops a regular-season one', () => {
    const [g] = parseScoreboard({ events: [tbdEvent({ note: 'Wild Card Playoffs', timeValid: false })] }, NFL)
    expect(g.kind).toBe('placeholder')
    expect(g.name).toBe('Wild Card Playoffs')
    expect(g.national).toBe(true)
    expect(g.timeKnown).toBe(false)
    expect(g.venueState).toBeNull()
    expect(parseScoreboard({ events: [tbdEvent({ seasonType: 2 })] }, NFL)).toEqual([])
  })

  it('gives the Super Bowl placeholder its venue state', () => {
    const [g] = parseScoreboard({ events: [tbdEvent({ note: 'Super Bowl LXI', venue: { city: 'Inglewood', state: 'CA' } })] }, NFL)
    expect(g.venueState).toBe('CA')
    expect(g.city).toBe('Inglewood')
  })

  it('keeps NCAA Tournament placeholders in college basketball, not conference tournaments', () => {
    const ncaa = tbdEvent({ id: '1', note: "NCAA Men's Basketball Championship - East Region - 1st Round" })
    const conf = tbdEvent({ id: '2', note: 'Big 12 Tournament - Semifinal' })
    expect(parseScoreboard({ events: [ncaa, conf] }, MCBB).map((g) => g.id)).toEqual(['1'])
  })

  it('marks the World Series national even with real teams', () => {
    const ev = {
      ...tbdEvent({ note: 'World Series - Game 1' }),
      competitions: [
        {
          ...tbdEvent({}).competitions[0],
          notes: [{ headline: 'World Series - Game 1' }],
          competitors: [
            { homeAway: 'home', team: { id: '19', shortDisplayName: 'Rangers', name: 'Rangers' } },
            { homeAway: 'away', team: { id: '18', shortDisplayName: 'Yankees', name: 'Yankees' } },
          ],
        },
      ],
    }
    const [g] = parseScoreboard({ events: [ev] }, MLB)
    expect(g.kind).toBe('game')
    expect(g.national).toBe(true)
    expect(g.name).toBe('World Series - Game 1')
  })
})

describe('parseEvents', () => {
  const golf = (name: string) => ({
    id: '55',
    name,
    shortName: name,
    date: '2027-04-08T04:00Z',
    endDate: '2027-04-11T04:00Z',
    season: { type: 2 },
    status: { type: { name: 'STATUS_SCHEDULED' } },
    competitions: [{ timeValid: false, broadcasts: [{ market: 'national', names: ['CBS'] }] }],
  })

  it('lists all four days of a major but only the weekend of a regular tour stop', () => {
    const major = parseEvents({ events: [golf('Masters Tournament')] }, PGA)
    expect(major.map((g) => g.name)).toEqual([
      'Masters Tournament, round 1',
      'Masters Tournament, round 2',
      'Masters Tournament, round 3',
      'Masters Tournament, final round',
    ])
    expect(major[3].importance).toBe(70)
    expect(major[0].importance).toBe(55)
    expect(major.every((g) => g.timeApprox && g.national && g.kind === 'event')).toBe(true)
    // Sunday final round at 2 PM Eastern
    expect(major[3].startIso).toBe(zonedTimeToIso('2027-04-11', 14, 0, 'America/New_York'))
    const regular = parseEvents({ events: [golf('RBC Heritage')] }, PGA)
    expect(regular.map((g) => g.name)).toEqual(['RBC Heritage, round 3', 'RBC Heritage, final round'])
  })

  it('takes the race from an F1 weekend, not practice or qualifying', () => {
    const ev = {
      id: '600057443',
      name: 'Tag Heuer Spanish Grand Prix',
      shortName: 'Tag Heuer Spanish GP',
      date: '2026-09-11T11:30Z',
      endDate: '2026-09-13T13:00Z',
      season: { type: 2 },
      status: { type: { name: 'STATUS_SCHEDULED' } },
      competitions: [
        { date: '2026-09-11T11:30Z', type: { abbreviation: 'FP1' }, timeValid: true },
        { date: '2026-09-12T14:00Z', type: { abbreviation: 'Qual' }, timeValid: true },
        { date: '2026-09-13T13:00Z', type: { abbreviation: 'Race' }, timeValid: true, broadcasts: [{ names: ['Apple TV'] }] },
      ],
    }
    const [g] = parseEvents({ events: [ev] }, F1)
    expect(g.startIso).toBe('2026-09-13T13:00Z')
    expect(g.name).toBe('Tag Heuer Spanish GP')
    expect(g.broadcasts.national).toEqual(['Apple TV'])
  })

  it('reads a UFC card with its arena state and skips the Contender Series', () => {
    const card = (id: string, name: string) => ({
      id,
      name,
      date: '2026-10-03T21:00Z',
      season: { type: 2 },
      status: { type: { name: 'STATUS_SCHEDULED' } },
      competitions: [{ timeValid: true, venue: { fullName: 'Delta Center', address: { city: 'Salt Lake City', state: 'UT' } } }],
    })
    const games = parseEvents({ events: [card('1', 'UFC 332: Silva vs. Wang'), card('2', "Dana White's Contender Series: Week 9")] }, UFC)
    expect(games).toHaveLength(1)
    expect(games[0].venueState).toBe('UT')
    expect(games[0].importance).toBe(40)
  })

  it('turns a tennis major into its finals weekend, and ignores other tournaments', () => {
    const ev = (name: string) => ({
      id: '189-2026',
      name,
      date: '2026-08-24T04:00Z',
      endDate: '2026-09-14T03:59Z',
      season: { type: 2 },
      status: { type: { name: 'STATUS_FINAL' } },
      competitions: [],
    })
    const finals = parseEvents({ events: [ev('US Open')] }, ATP)
    expect(finals.map((g) => g.name)).toEqual(["US Open women's final", "US Open men's final"])
    expect(finals[1].startIso).toBe(zonedTimeToIso('2026-09-13', 14, 0, 'America/New_York'))
    expect(parseEvents({ events: [ev('Cincinnati Open')] }, ATP)).toEqual([])
  })
})

describe('buildDayPlan', () => {
  const masters = game({
    start: zonedTimeToIso('2027-04-11', 14, 0, 'America/New_York'),
    league: PGA,
    kind: 'event',
    name: 'Masters Tournament, final round',
    importance: 70,
    timeApprox: true,
    home: NO_TEAM,
    away: NO_TEAM,
    neutral: true,
    city: null,
    venueState: null,
    broadcasts: { national: ['CBS'], home: [], away: [] },
    national: true,
  })
  const wildCard = game({
    start: '2027-01-17T05:00Z',
    kind: 'placeholder',
    name: 'Wild Card Playoffs',
    timeKnown: false,
    home: NO_TEAM,
    away: NO_TEAM,
    neutral: true,
    city: null,
    venueState: null,
    broadcasts: { national: [], home: [], away: [] },
    postseason: true,
    national: true,
  })

  it('shows a national event to any state, with an approximate time and an event headline', () => {
    const plan = buildDayPlan({ games: [masters], state: 'WY', timeZone: 'America/Denver', ymd: '2027-04-11' })
    expect(plan.weekdayName).toBe('Sunday')
    expect(plan.rows).toHaveLength(1)
    expect(plan.rows[0].involvement).toBe('national')
    expect(plan.rows[0].timeText).toBe('~12:00 PM')
    expect(plan.rows[0].matchup).toBe('Masters Tournament, final round')
    expect(plan.rows[0].detail).toBe('CBS')
    expect(plan.bigGame).toBe(plan.rows[0])
    expect(plan.headline).toBe('Wide open until Masters Tournament, final round starts at ~12:00 PM.')
    expect(plan.goBold).toBe('Or Go Bold during Masters Tournament, final round.')
    expect(plan.sun?.sunsetText).toMatch(/PM$/)
  })

  it('lists a playoff placeholder under Time TBA with "Teams TBA"', () => {
    const plan = buildDayPlan({ games: [wildCard], state: 'TX', timeZone: 'America/Chicago', ymd: '2027-01-17' })
    expect(plan.tba).toHaveLength(1)
    expect(plan.tba[0].matchup).toBe('Wild Card Playoffs')
    expect(plan.tba[0].detail).toBe('Teams TBA')
    expect(plan.meter.every((c) => c === 0)).toBe(true)
    expect(daySummary(plan)).toEqual({ heat: 0, big: false, tba: 1, expected: 0, total: 1 })
  })

  it('keeps hand-kept expected events apart from announced games', () => {
    const [expected] = curatedGames('2027-04-03', '2027-04-03')
    const plan = buildDayPlan({ games: [expected], state: 'MI', timeZone: 'America/Detroit', ymd: '2027-04-03' })
    expect(plan.expected).toHaveLength(1)
    expect(plan.expected[0].involvement).toBe('here') // Detroit
    expect(plan.expected[0].detail).toBe('Details TBA · Detroit')
    expect(plan.tba).toEqual([])
    expect(daySummary(plan).expected).toBe(1)
    // A different state still sees it, as national.
    expect(buildDayPlan({ games: [expected], state: 'TX', timeZone: 'America/Chicago', ymd: '2027-04-03' }).expected[0].involvement).toBe('national')
  })

  it('shades the calendar by the busiest hour, red when the Big one is on', () => {
    const noon = game({ start: '2026-09-20T17:00:00Z' }) // noon Central, Cowboys at home: big
    const plan = buildDayPlan({ games: [noon], state: 'TX', timeZone: 'America/Chicago', ymd: '2026-09-20' })
    expect(daySummary(plan).heat).toBe(3)
    const quiet = buildDayPlan({ games: [noon], state: 'TX', timeZone: 'America/Chicago', ymd: '2026-09-21' })
    expect(daySummary(quiet).heat).toBe(0)
    expect(weekdayName('2026-09-21')).toBe('Monday')
  })

  it('leaves national events and placeholders out of the Wednesday email', () => {
    const plan = buildWeekendPlan({ games: [masters, wildCard], state: 'TX', timeZone: 'America/Chicago', saturdayYmd: '2027-04-10' })
    expect(plan.totalGames).toBe(0)
  })
})

describe('curated placeholders', () => {
  it('produces one placeholder per day inside the window, and only there', () => {
    const rows = curatedGames('2027-03-18', '2027-03-21')
    expect(rows.filter((g) => g.league.key === MCBB.key).map((g) => g.name)).toEqual([
      "NCAA Men's Tournament, first round",
      "NCAA Men's Tournament, first round",
      "NCAA Men's Tournament, second round",
      "NCAA Men's Tournament, second round",
    ])
    expect(rows.every((g) => g.expected && !g.timeKnown && g.national && g.kind === 'placeholder')).toBe(true)
    expect(curatedGames('2026-09-01', '2026-09-30')).toEqual([])
    expect(CURATED.every((c) => leagueByKey(c.leagueKey) && c.from <= c.to)).toBe(true)
  })

  it('steps aside once ESPN lists the real postseason game that day', () => {
    const curated = curatedGames('2027-03-18', '2027-03-19')
    const real = game({
      start: '2027-03-18T17:00:00Z',
      league: MCBB,
      postseason: true,
      name: "NCAA Men's Basketball Championship - 1st Round",
    })
    const left = withoutSuperseded(curated, [real]).filter((g) => g.league.key === MCBB.key)
    expect(left.map((g) => g.startIso.slice(0, 10))).toEqual(['2027-03-19'])
  })
})

describe('rows and wire format', () => {
  it('round-trips a game through the database row and the API shape', () => {
    const g = game({ start: '2026-09-20T17:00:00.000Z', name: null })
    const row = toRow(g, '2026-09-16T12:00:00.000Z')
    expect(row.id).toBe('football/nfl:2026-09-20T17:00:00.000Z')
    expect(row.day_et).toBe('2026-09-20')
    expect(row.home_state).toBe('TX')
    expect(row.away_state).toBe('PA')
    expect(fromRow(row)).toEqual(g)
    expect(fromRow({ ...row, league_key: 'football/xfl' })).toBeNull()
    expect(fromWire(toWire(g))).toEqual(g)
    expect('league' in toWire(g)).toBe(false)
  })
})

describe('fetchLeagueRange', () => {
  function fakeEspn(o: { capMonth?: string; fail?: (url: string) => boolean } = {}) {
    const urls: string[] = []
    const impl = (async (input: string | URL | Request) => {
      const url = String(input)
      urls.push(url)
      if (o.fail?.(url)) return new Response('nope', { status: 500 })
      const dates = new URL(url).searchParams.get('dates') ?? ''
      let events: unknown[] = []
      if (dates.length === 6 && dates === o.capMonth) {
        events = Array.from({ length: 500 }, (_, i) => ({ ...tbdEvent({ id: `c${i}`, note: 'Wild Card Playoffs' }) }))
      } else if (dates === '202701' || dates === '20270117') {
        events = [tbdEvent({ note: 'Wild Card Playoffs', date: '2027-01-17T05:00Z' })]
      }
      return new Response(JSON.stringify({ events }), { status: 200 })
    }) as unknown as typeof fetch
    return { impl, urls }
  }

  it('reads a month at a time plus the near term by day, and merges by id', async () => {
    const { impl, urls } = fakeEspn()
    const games = await fetchLeagueRange(NFL, '2027-01-10', '2027-02-20', impl, { nearDays: 10 })
    expect(urls.filter((u) => /dates=2027(01|02)(&|$)/.test(u))).toHaveLength(2)
    expect(urls.filter((u) => /dates=202701\d\d/.test(u))).toHaveLength(10)
    expect(games).toHaveLength(1)
  })

  it('falls back to day-by-day for a month that hits the 500-game cap', async () => {
    const { impl, urls } = fakeEspn({ capMonth: '202701' })
    await fetchLeagueRange(NFL, '2027-01-01', '2027-01-31', impl, { nearDays: 0 })
    expect(urls.filter((u) => /dates=202701\d\d/.test(u))).toHaveLength(31)
  })

  it('reads college basketball a day at a time', async () => {
    const { impl, urls } = fakeEspn()
    await fetchLeagueRange(MCBB, '2027-01-01', '2027-01-05', impl)
    expect(urls.every((u) => /dates=202701\d\d/.test(u) && u.includes('groups=50'))).toBe(true)
    expect(urls).toHaveLength(5)
  })

  it('throws when ESPN cannot be read, so the caller keeps last week', async () => {
    const { impl } = fakeEspn({ fail: () => true })
    await expect(fetchLeagueRange(NFL, '2027-01-01', '2027-01-03', impl, { nearDays: 0 })).rejects.toThrow(/HTTP 500/)
  }, 20_000)
})

describe('ZIP lookup', () => {
  const google = (o: { postal?: string; state?: string; city?: string; status?: string }) => ({
    status: o.status ?? 'OK',
    results: [
      {
        address_components: [
          { long_name: o.postal ?? '77005', short_name: o.postal ?? '77005', types: ['postal_code'] },
          { long_name: o.city ?? 'Houston', short_name: o.city ?? 'Houston', types: ['locality', 'political'] },
          { long_name: 'Texas', short_name: o.state ?? 'TX', types: ['administrative_area_level_1', 'political'] },
          { long_name: 'United States', short_name: 'US', types: ['country', 'political'] },
        ],
        geometry: { location: { lat: 29.72, lng: -95.42 } },
      },
    ],
  })

  it('accepts only 5-digit ZIPs', () => {
    expect(normalizeZip('77005')).toBe('77005')
    expect(normalizeZip(' 77005-1234 ')).toBe('77005')
    expect(normalizeZip('7700')).toBeNull()
    expect(normalizeZip('abcde')).toBeNull()
    expect(normalizeZip(null)).toBeNull()
  })

  it('reads the place out of a Google answer, and rejects a near-miss', () => {
    expect(parseZipGeocode('77005', google({}))).toEqual({ zip: '77005', state: 'TX', city: 'Houston', at: { lat: 29.72, lng: -95.42 } })
    // Google answers a made-up ZIP with the closest real one: not a match.
    expect(parseZipGeocode('77000', google({ postal: '77005' }))).toBeNull()
    expect(parseZipGeocode('77005', google({ status: 'ZERO_RESULTS' }))).toBeNull()
    expect(parseZipGeocode('77005', { status: 'OK', results: [] })).toBeNull()
  })

  it('lets the planner pick the visitor’s own market from a ZIP', () => {
    const texans = game({
      start: '2026-09-20T17:00:00Z',
      id: 'hou',
      home: { id: '34', short: 'Texans', nickname: 'Texans', rank: null, homeState: 'TX', homeAt: { lat: 29.76, lng: -95.37 } },
      away: { id: '4', short: 'Bengals', nickname: 'Bengals', rank: null, homeState: 'OH' },
      city: 'Houston',
      broadcasts: { national: ['CBS'], home: [], away: [] },
    })
    const cowboys = game({
      start: '2026-09-20T20:25:00Z',
      id: 'dal',
      home: { id: '6', short: 'Cowboys', nickname: 'Cowboys', rank: null, homeState: 'TX', homeAt: { lat: 32.74, lng: -97.11 } },
    })
    const base = { games: [texans, cowboys], state: 'TX', timeZone: 'America/Chicago', ymd: '2026-09-20' }
    expect(buildDayPlan(base).bigGame?.stateTeam.short).toBe('Cowboys')
    const houston = buildDayPlan({ ...base, location: { at: { lat: 29.72, lng: -95.42 }, source: 'zip' } })
    expect(houston.bigGame?.stateTeam.short).toBe('Texans')
    expect(houston.rows.map((p) => [p.stateTeam.short, p.local])).toEqual([['Texans', true], ['Cowboys', false]])
  })
})
