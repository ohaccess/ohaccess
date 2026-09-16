import { describe, it, expect } from 'vitest'
import { fetchWeekendGames, parseScoreboard, venueLocation, type Game, type TeamSide } from '../lib/weekend-games/espn'
import { LEAGUES } from '../lib/weekend-games/leagues'
import { addDays, dateLabel, timeLabel, timeZoneLabel, zonedParts } from '../lib/weekend-games/time'
import {
  agentTimeZone,
  sendDue,
  settingsComplete,
  weekendGamesEmailKey,
  weekendGamesState,
} from '../lib/weekend-games/audience'
import { buildWeekendPlan, sweetSpot } from '../lib/weekend-games/plan'
import { buildWeekendGamesEmail } from '../lib/weekend-games/email'

const league = (key: string) => LEAGUES.find((l) => l.key === key)!
const NFL = league('football/nfl')
const CFB = league('football/college-football')
const MLB = league('baseball/mlb')
const MCBB = league('basketball/mens-college-basketball')

// ── ESPN parsing ──────────────────────────────────────────────────────────
function espnEvent(o: {
  id?: string
  date?: string
  homeId?: string
  awayId?: string
  homeRank?: number
  venue?: { city?: string; state?: string }
  venueName?: string
  neutral?: boolean
  status?: string
  timeValid?: boolean
  seasonType?: number
  note?: string
  broadcasts?: { market: string; names: string[] }[]
}) {
  return {
    id: o.id ?? '1',
    date: o.date ?? '2026-09-20T20:25Z',
    season: { type: o.seasonType ?? 2 },
    status: { type: { name: o.status ?? 'STATUS_SCHEDULED', shortDetail: '9/20 - 3:25 PM EDT' } },
    competitions: [
      {
        timeValid: o.timeValid ?? true,
        neutralSite: o.neutral ?? false,
        venue: { fullName: o.venueName ?? 'Stadium', address: o.venue },
        notes: o.note ? [{ headline: o.note }] : [],
        broadcasts: o.broadcasts ?? [{ market: 'national', names: ['FOX'] }],
        competitors: [
          {
            homeAway: 'home',
            curatedRank: { current: o.homeRank ?? 99 },
            team: { id: o.homeId ?? '6', shortDisplayName: 'Cowboys', name: 'Cowboys' },
          },
          {
            homeAway: 'away',
            curatedRank: { current: 99 },
            team: { id: o.awayId ?? '28', shortDisplayName: 'Commanders', name: 'Commanders' },
          },
        ],
      },
    ],
  }
}

describe('parseScoreboard', () => {
  it('normalizes a pro game and looks up each team’s home state', () => {
    const [g] = parseScoreboard({ events: [espnEvent({ venue: { city: 'Arlington', state: 'TX' } })] }, NFL)
    expect(g.venueState).toBe('TX')
    expect(g.city).toBe('Arlington')
    expect(g.home.homeState).toBe('TX')
    expect(g.away.homeState).toBe('MD') // the Commanders play in Landover, MD
    expect(g.broadcasts.national).toEqual(['FOX'])
    expect(g.timeKnown).toBe(true)
  })

  it('reads full state names, "City, State" cities, and falls back to the home team', () => {
    expect(venueLocation({ city: 'Houston', state: 'Texas' })).toEqual({ city: 'Houston', state: 'TX' })
    expect(venueLocation({ city: 'Houston, Texas' })).toEqual({ city: 'Houston', state: 'TX' })
    expect(venueLocation({ city: 'Toyota Stadium' }, 'Toyota Stadium')).toEqual({ city: null, state: null })
    const [g] = parseScoreboard({ events: [espnEvent({ venue: { city: 'Somewhere' } })] }, NFL)
    expect(g.venueState).toBe('TX')
  })

  it('skips preseason, postponed and canceled games, and flags unannounced kickoffs', () => {
    expect(parseScoreboard({ events: [espnEvent({ seasonType: 1 })] }, NFL)).toEqual([])
    expect(parseScoreboard({ events: [espnEvent({ status: 'STATUS_POSTPONED' })] }, NFL)).toEqual([])
    expect(parseScoreboard({ events: [espnEvent({ status: 'STATUS_CANCELED' })] }, NFL)).toEqual([])
    const [g] = parseScoreboard({ events: [espnEvent({ timeValid: false })] }, NFL)
    expect(g.timeKnown).toBe(false)
  })

  it('keeps college basketball only when it matters', () => {
    const unranked = espnEvent({})
    const ranked = espnEvent({ id: '2', homeRank: 7 })
    const tourney = espnEvent({ id: '3', seasonType: 3, note: "NCAA Men's Basketball Championship - South Region - 2nd Round" })
    const conferenceTourney = espnEvent({ id: '4', seasonType: 3, note: 'Big 12 Tournament - Quarterfinal' })
    const ids = parseScoreboard({ events: [unranked, ranked, tourney, conferenceTourney] }, MCBB).map((g) => g.id)
    expect(ids).toEqual(['2', '3'])
  })
})

// A stand-in for fetch: one Cowboys game on Sunday in the NFL feed, empty
// feeds elsewhere, and HTTP 400 for any URL `fails` matches.
function fakeEspn(fails: (url: string) => boolean) {
  const urls: string[] = []
  const impl = (async (input: string | URL | Request) => {
    const url = String(input)
    urls.push(url)
    if (fails(url)) return new Response('bad request', { status: 400 })
    const events =
      url.includes('football/nfl') && url.includes('dates=20260920')
        ? [espnEvent({ venue: { city: 'Arlington', state: 'TX' } })]
        : []
    return new Response(JSON.stringify({ events }), { status: 200 })
  }) as unknown as typeof fetch
  return { impl, urls }
}

describe('fetchWeekendGames', () => {
  it('asks ESPN for each day separately, two ways, never a date range, and merges the answers', async () => {
    const { impl, urls } = fakeEspn(() => false)
    const { games, skippedLeagues } = await fetchWeekendGames('2026-09-19', '2026-09-20', impl)
    expect(urls).toHaveLength(LEAGUES.length * 2 * 2)
    expect(urls.every((u) => /dates=202609(19|20)(&|$)/.test(u))).toBe(true)
    expect(urls.some((u) => u.includes('20260919-20260920'))).toBe(false)
    expect(urls.some((u) => u.includes('limit=1000'))).toBe(false)
    expect(urls.filter((u) => u.includes('limit=500'))).toHaveLength(LEAGUES.length * 2)
    // The same Cowboys game came back from both request forms: listed once.
    expect(games.map((g) => g.home.short)).toEqual(['Cowboys'])
    expect(skippedLeagues).toEqual([])
  })

  it('keeps going when only one request form fails', async () => {
    const { impl } = fakeEspn((u) => u.includes('limit=500'))
    const { games, skippedLeagues } = await fetchWeekendGames('2026-09-19', '2026-09-20', impl)
    expect(games.map((g) => g.home.short)).toEqual(['Cowboys'])
    expect(skippedLeagues).toEqual([])
  }, 15_000)

  it('leaves out an optional league ESPN cannot serve, and says so', async () => {
    const { impl } = fakeEspn((u) => u.includes('soccer/usa.1'))
    const { games, skippedLeagues } = await fetchWeekendGames('2026-09-19', '2026-09-20', impl)
    expect(games).toHaveLength(1)
    expect(skippedLeagues).toEqual(['soccer/usa.1'])
  }, 15_000)

  it('refuses to build a lineup without a required league', async () => {
    const { impl } = fakeEspn((u) => u.includes('football/nfl'))
    await expect(fetchWeekendGames('2026-09-19', '2026-09-20', impl)).rejects.toThrow(/football\/nfl.*HTTP 400/)
  }, 15_000)
})

// ── Time + audience ───────────────────────────────────────────────────────
describe('time helpers', () => {
  it('formats times, dates and zone names', () => {
    expect(timeLabel(14, 30)).toBe('2:30 PM')
    expect(timeLabel(0, 5)).toBe('12:05 AM')
    expect(timeLabel(12, 0)).toBe('12:00 PM')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(dateLabel('2026-09-19')).toBe('Sep 19')
    expect(timeZoneLabel('America/Chicago')).toBe('Central Time')
    expect(timeZoneLabel('America/Phoenix')).toBe('Mountain Time')
    expect(zonedParts(new Date('2026-09-16T13:00:00Z'), 'America/Chicago')).toEqual({
      ymd: '2026-09-16',
      weekday: 3,
      hour: 8,
      minute: 0,
    })
  })
})

describe('audience', () => {
  const complete = {
    full_name: 'Kathryn Lee',
    brokerage: 'Premier Realty',
    phone: '+12145550182',
    license_number: 'TX-123456',
    state: 'TX',
    country: 'US',
  }

  it('needs every Settings field filled in', () => {
    expect(settingsComplete(complete)).toBe(true)
    expect(settingsComplete({ ...complete, license_number: '  ' })).toBe(false)
    expect(weekendGamesState({ ...complete, phone: null })).toBeNull()
  })

  it('is US only, and accepts a state name', () => {
    expect(weekendGamesState(complete)).toBe('TX')
    expect(weekendGamesState({ ...complete, state: 'texas' })).toBe('TX')
    expect(weekendGamesState({ ...complete, country: 'CA', state: 'ON' })).toBeNull()
    expect(weekendGamesState({ ...complete, country: null, state: 'ON' })).toBeNull()
  })

  it('sends Wednesday 8 to 10 AM in the agent’s zone, for the coming weekend', () => {
    const chicago = agentTimeZone('TX')
    expect(chicago).toBe('America/Chicago')
    expect(sendDue(new Date('2026-09-16T13:00:00Z'), chicago)).toEqual({ saturdayYmd: '2026-09-19' })
    expect(sendDue(new Date('2026-09-16T15:59:00Z'), chicago)).toEqual({ saturdayYmd: '2026-09-19' })
    expect(sendDue(new Date('2026-09-16T16:00:00Z'), chicago)).toBeNull() // 11 AM
    expect(sendDue(new Date('2026-09-15T13:00:00Z'), chicago)).toBeNull() // Tuesday
    expect(sendDue(new Date('2026-09-16T15:00:00Z'), agentTimeZone('AZ'))).toEqual({ saturdayYmd: '2026-09-19' })
    expect(weekendGamesEmailKey('2026-09-19')).toBe('weekend_games_2026-09-19')
  })

  it('catch-up mode ignores the clock, Wednesday through Friday only', () => {
    const chicago = agentTimeZone('TX')
    const catchup = { catchup: true }
    expect(sendDue(new Date('2026-09-16T20:11:00Z'), chicago, catchup)).toEqual({ saturdayYmd: '2026-09-19' }) // Wed 3 PM
    expect(sendDue(new Date('2026-09-18T23:00:00Z'), chicago, catchup)).toEqual({ saturdayYmd: '2026-09-19' }) // Fri 6 PM
    expect(sendDue(new Date('2026-09-19T15:00:00Z'), chicago, catchup)).toBeNull() // Saturday
    expect(sendDue(new Date('2026-09-15T15:00:00Z'), chicago, catchup)).toBeNull() // Tuesday
    expect(sendDue(new Date('2026-09-16T20:11:00Z'), chicago)).toBeNull() // no catch-up flag: window closed
  })
})

// ── Plan + email ──────────────────────────────────────────────────────────
function team(o: Partial<TeamSide> & { short: string }): TeamSide {
  return { id: o.short, nickname: o.short, rank: null, homeState: null, ...o }
}

function game(o: Partial<Game> & { start: string }): Game {
  const { start, ...rest } = o
  return {
    id: start + (o.home?.short ?? ''),
    league: CFB,
    startIso: start,
    timeKnown: true,
    home: team({ short: 'Home' }),
    away: team({ short: 'Away' }),
    neutral: false,
    city: null,
    venueState: null,
    broadcasts: { national: [], home: [], away: [] },
    postseason: false,
    ...rest,
  }
}

const texasWeekend: Game[] = [
  game({
    start: '2026-09-19T16:00:00Z', // 11:00 AM Central
    home: team({ short: 'Texas State', nickname: 'Bobcats', homeState: 'TX' }),
    away: team({ short: 'North Texas', nickname: 'Mean Green', homeState: 'TX' }),
    venueState: 'TX',
    city: 'San Marcos',
    broadcasts: { national: ['USA Net'], home: [], away: [] },
  }),
  game({
    start: '2026-09-19T19:30:00Z', // 2:30 PM
    home: team({ short: 'Texas A&M', nickname: 'Aggies', homeState: 'TX' }),
    away: team({ short: 'Kentucky', nickname: 'Wildcats', homeState: 'KY' }),
    venueState: 'TX',
    city: 'College Station',
    broadcasts: { national: ['ESPN'], home: [], away: [] },
  }),
  game({
    start: '2026-09-19T19:30:00Z',
    home: team({ short: 'Louisville', homeState: 'KY' }),
    away: team({ short: 'SMU', nickname: 'Mustangs', homeState: 'TX' }),
    venueState: 'KY',
    city: 'Louisville',
    broadcasts: { national: ['ESPN2'], home: [], away: [] },
  }),
  game({
    start: '2026-09-19T16:00:00Z',
    home: team({ short: 'Ohio State', homeState: 'OH' }),
    away: team({ short: 'Kent State', homeState: 'OH' }),
    venueState: 'OH',
  }),
  game({
    start: '2026-09-20T00:00:00Z', // Saturday 7:00 PM
    home: team({ short: 'Texas', nickname: 'Longhorns', homeState: 'TX' }),
    away: team({ short: 'UTSA', homeState: 'TX' }),
    venueState: 'TX',
    city: 'Austin',
  }),
  game({
    start: '2026-09-19T04:00:00Z', // placeholder time: kickoff not announced
    timeKnown: false,
    home: team({ short: 'Baylor', homeState: 'TX' }),
    away: team({ short: 'Louisiana Tech', homeState: 'LA' }),
    venueState: 'TX',
    city: 'Waco',
  }),
  game({
    league: NFL,
    start: '2026-09-20T17:00:00Z', // Sunday 12:00 PM
    home: team({ short: 'Texans', homeState: 'TX' }),
    away: team({ short: 'Bengals', homeState: 'OH' }),
    venueState: 'TX',
    city: 'Houston',
    broadcasts: { national: ['CBS'], home: [], away: [] },
  }),
  game({
    league: MLB,
    start: '2026-09-20T18:10:00Z', // 1:10 PM
    home: team({ short: 'Astros', homeState: 'TX' }),
    away: team({ short: 'Braves', homeState: 'GA' }),
    venueState: 'TX',
    city: 'Houston',
    broadcasts: { national: ['MLB.TV'], home: ['Space City Home Network'], away: ['BravesVision'] },
  }),
  game({
    league: NFL,
    start: '2026-09-20T20:25:00Z', // 3:25 PM
    home: team({ short: 'Cowboys', homeState: 'TX' }),
    away: team({ short: 'Commanders', homeState: 'MD' }),
    venueState: 'TX',
    city: 'Arlington',
    broadcasts: { national: ['FOX'], home: [], away: [] },
  }),
]

const plan = buildWeekendPlan({
  games: texasWeekend,
  state: 'TX',
  timeZone: 'America/Chicago',
  saturdayYmd: '2026-09-19',
})

describe('buildWeekendPlan', () => {
  it('keeps in-state games and state teams playing away, drops the rest', () => {
    const sat = plan.saturday
    expect(sat.rows.map((p) => p.matchup)).toEqual([
      'North Texas at Texas State',
      'Kentucky at Texas A&M',
      'SMU at Louisville',
    ])
    expect(sat.rows[2].involvement).toBe('away')
    expect(sat.rows[2].detail).toBe('📺 Away game · ESPN2')
    expect(sat.rows[1].detail).toBe('College Station · ESPN')
    expect(sat.afterHours.map((p) => p.stateTeam.short)).toEqual(['Texas'])
    expect(sat.tba.map((p) => p.matchup)).toEqual(['Louisiana Tech at Baylor'])
    expect(plan.totalGames).toBe(8) // Ohio State's game isn't a Texas game
  })

  it('builds the game meter, sweet spot, Big one and headline', () => {
    const sat = plan.saturday
    expect(sat.meter).toEqual([0, 1, 1, 1, 3, 2, 2, 2])
    expect(sat.sweetSpot).toEqual({ label: 'Sweet spot', text: '10 AM to 11 AM' })
    expect(sat.bigGame?.matchup).toBe('Kentucky at Texas A&M')
    expect(sat.headline).toBe('Mostly open until the Aggies kick off at 2:30 PM.')
    expect(sat.goBold).toBe('Or Go Bold during Texas A&M vs Kentucky.')

    const sun = plan.sunday
    expect(sun.meter).toEqual([0, 0, 1, 2, 2, 3, 2, 1])
    expect(sun.sweetSpot.text).toBe('10 AM to 12 PM')
    expect(sun.bigGame?.matchup).toBe('Commanders at Cowboys') // NFL tie goes to the later kickoff
    expect(sun.headline).toBe('Sunday belongs to the Cowboys. Kickoff 3:25 PM on FOX.')
    expect(sun.rows.find((p) => p.stateTeam.short === 'Astros')?.tv).toBe('Space City Home Network')
    expect(plan.bigGame?.stateTeam.short).toBe('Cowboys')
    expect(plan.timeZoneText).toBe('Central Time')
  })

  it('falls back to the lightest stretch when no hour is clear', () => {
    expect(sweetSpot([1, 1, 2, 3, 3, 2, 1, 1])).toEqual({ label: 'Lightest stretch', text: '10 AM to 12 PM' })
    expect(sweetSpot([0, 0, 0, 0, 0, 0, 0, 0]).text).toBe('any time from 10 AM to 6 PM')
  })

  it('never makes an evening game the Big one', () => {
    const evening = buildWeekendPlan({
      games: [game({ league: NFL, start: '2026-09-20T00:20:00Z', home: team({ short: 'Cowboys', homeState: 'TX' }), venueState: 'TX' })],
      state: 'TX',
      timeZone: 'America/Chicago',
      saturdayYmd: '2026-09-19',
    })
    expect(evening.saturday.afterHours).toHaveLength(1)
    expect(evening.saturday.bigGame).toBeNull()
    expect(evening.saturday.headline).toBe('A light one: just one game, nothing huge.')
  })

  it('writes a quiet day and a light day', () => {
    const quiet = buildWeekendPlan({ games: [], state: 'WY', timeZone: 'America/Denver', saturdayYmd: '2026-09-19' })
    expect(quiet.saturday.headline).toBe('Coast is clear. Not a single game on the schedule.')
    expect(quiet.stateName).toBe('Wyoming')
    const light = buildWeekendPlan({
      games: [game({ league: MLB, start: '2026-09-19T23:05:00Z', home: team({ short: 'Rangers', homeState: 'TX' }), venueState: 'TX' })],
      state: 'TX',
      timeZone: 'America/Chicago',
      saturdayYmd: '2026-09-19',
    })
    expect(light.saturday.headline).toBe('A light one: just one game, nothing huge.')
  })
})

describe('buildWeekendGamesEmail', () => {
  const APP_URL = 'https://www.ohaccess.com'
  const UNSUB = `${APP_URL}/unsubscribe?agent=tok-123`

  it('renders the full lineup', () => {
    const { subject, html } = buildWeekendGamesEmail({ firstName: 'Kathryn', plan, appUrl: APP_URL, unsubscribeUrl: UNSUB })
    expect(subject).toBe('Planning on an Open House this weekend? 🏈 Your Texas game-day lineup')
    expect(html).toContain('Hi Kathryn,')
    expect(html).toContain('So are the Cowboys.')
    expect(html).toContain('Team "Go Bold"')
    expect(html).toContain('Mostly open until the Aggies kick off at 2:30 PM.')
    expect(html).toContain('Sunday belongs to the Cowboys. Kickoff 3:25 PM on FOX.')
    expect(html).toContain('Big one')
    expect(html).toContain('10 AM to 11 AM. Or Go Bold during Texas A&amp;M vs Kentucky.')
    expect(html).toContain('Kentucky at Texas A&amp;M')
    expect(html).toContain('1 more game</strong>: Texas.')
    expect(html).toContain('Time TBA')
    expect(html).toContain(`${APP_URL}/dashboard?view=new`)
    expect(html).toContain('Times are Central Time and come from ESPN.')
    expect(html).toContain('Whoever walks in during the 4th quarter really wants the house.')
    expect(html).toContain(UNSUB)
    expect(html).not.toContain('—')
  })

  it('has a coast-is-clear version and escapes names', () => {
    const quiet = buildWeekendPlan({ games: [], state: 'WY', timeZone: 'America/Denver', saturdayYmd: '2026-09-19' })
    const { subject, html } = buildWeekendGamesEmail({
      firstName: '<script>x</script>',
      plan: quiet,
      appUrl: APP_URL,
      unsubscribeUrl: UNSUB,
    })
    expect(subject).toBe('Planning on an Open House this weekend? The coast is clear in Wyoming')
    expect(html).toContain('Coast is clear, Wyoming.')
    expect(html).not.toContain('Team "Go Bold"')
    expect(html).not.toContain('<script>')
  })
})
