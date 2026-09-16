import { NO_TEAM, type Game } from '../weekend-games/espn'
import { leagueByKey } from '../weekend-games/leagues'
import { addDays, zonedParts } from '../weekend-games/time'

// Events we know are coming but ESPN doesn't list yet: the NCAA
// Tournament, the NBA and NHL playoffs, the Derby, the Indy 500. Each shows
// on the planner as "expected" (usual dates, details TBA) until ESPN
// publishes the real games for that day, at which point the ESPN rows win
// (see withoutSuperseded). ESPN already carries the NFL playoffs, the Super
// Bowl, the College Football Playoff and the MLB postseason as "TBD at TBD"
// placeholders, so those aren't here.
//
// Dates are the customary windows for the 2026-27 season. Once an event is
// over, its entry is dead weight but harmless; add next season's when the
// governing body publishes it.

export type CuratedEvent = {
  key: string // stable id fragment
  leagueKey: string
  name: string
  from: string // first day, YYYY-MM-DD
  to: string // last day, inclusive
  importance: number
  city?: string
  venueState?: string
}

const MCBB = 'basketball/mens-college-basketball'
const WCBB = 'basketball/womens-college-basketball'

export const CURATED: CuratedEvent[] = [
  // NCAA men's tournament 2027 (Final Four: Detroit, April 3 and 5)
  { key: 'ncaam-first-four', leagueKey: MCBB, name: "NCAA Men's Tournament, First Four", from: '2027-03-16', to: '2027-03-17', importance: 45 },
  { key: 'ncaam-r1', leagueKey: MCBB, name: "NCAA Men's Tournament, first round", from: '2027-03-18', to: '2027-03-19', importance: 60 },
  { key: 'ncaam-r2', leagueKey: MCBB, name: "NCAA Men's Tournament, second round", from: '2027-03-20', to: '2027-03-21', importance: 60 },
  { key: 'ncaam-s16', leagueKey: MCBB, name: "NCAA Men's Tournament, Sweet 16", from: '2027-03-25', to: '2027-03-26', importance: 55 },
  { key: 'ncaam-e8', leagueKey: MCBB, name: "NCAA Men's Tournament, Elite Eight", from: '2027-03-27', to: '2027-03-28', importance: 55 },
  { key: 'ncaam-ff', leagueKey: MCBB, name: "NCAA Men's Final Four", from: '2027-04-03', to: '2027-04-03', importance: 70, city: 'Detroit', venueState: 'MI' },
  { key: 'ncaam-final', leagueKey: MCBB, name: "NCAA Men's National Championship", from: '2027-04-05', to: '2027-04-05', importance: 70, city: 'Detroit', venueState: 'MI' },
  // NCAA women's tournament 2027 (Final Four: Columbus, April 2 and 4)
  { key: 'ncaaw-r1', leagueKey: WCBB, name: "NCAA Women's Tournament, first round", from: '2027-03-19', to: '2027-03-20', importance: 50 },
  { key: 'ncaaw-r2', leagueKey: WCBB, name: "NCAA Women's Tournament, second round", from: '2027-03-21', to: '2027-03-22', importance: 50 },
  { key: 'ncaaw-s16', leagueKey: WCBB, name: "NCAA Women's Tournament, Sweet 16", from: '2027-03-26', to: '2027-03-27', importance: 45 },
  { key: 'ncaaw-e8', leagueKey: WCBB, name: "NCAA Women's Tournament, Elite Eight", from: '2027-03-28', to: '2027-03-29', importance: 45 },
  { key: 'ncaaw-ff', leagueKey: WCBB, name: "NCAA Women's Final Four", from: '2027-04-02', to: '2027-04-02', importance: 60, city: 'Columbus', venueState: 'OH' },
  { key: 'ncaaw-final', leagueKey: WCBB, name: "NCAA Women's National Championship", from: '2027-04-04', to: '2027-04-04', importance: 60, city: 'Columbus', venueState: 'OH' },
  // NBA 2027
  { key: 'nba-playin', leagueKey: 'basketball/nba', name: 'NBA Play-In Tournament', from: '2027-04-13', to: '2027-04-16', importance: 40 },
  { key: 'nba-playoffs', leagueKey: 'basketball/nba', name: 'NBA Playoffs', from: '2027-04-17', to: '2027-06-01', importance: 55 },
  { key: 'nba-finals', leagueKey: 'basketball/nba', name: 'NBA Finals', from: '2027-06-03', to: '2027-06-20', importance: 70 },
  // NHL 2027
  { key: 'nhl-playoffs', leagueKey: 'hockey/nhl', name: 'Stanley Cup Playoffs', from: '2027-04-19', to: '2027-06-04', importance: 50 },
  { key: 'nhl-final', leagueKey: 'hockey/nhl', name: 'Stanley Cup Final', from: '2027-06-07', to: '2027-06-25', importance: 65 },
  // One-day events ESPN's feeds don't carry (or don't carry yet)
  { key: 'kentucky-derby', leagueKey: 'racing/irl', name: 'Kentucky Derby', from: '2027-05-01', to: '2027-05-01', importance: 60, city: 'Louisville', venueState: 'KY' },
  { key: 'indy-500', leagueKey: 'racing/irl', name: 'Indianapolis 500', from: '2027-05-30', to: '2027-05-30', importance: 75, city: 'Indianapolis', venueState: 'IN' },
]

// One placeholder Game per day of each event that falls in the window.
export function curatedGames(fromYmd: string, toYmd: string): Game[] {
  const games: Game[] = []
  for (const ev of CURATED) {
    const league = leagueByKey(ev.leagueKey)
    if (!league) continue
    for (let d = ev.from; d <= ev.to; d = addDays(d, 1)) {
      if (d < fromYmd || d > toYmd) continue
      games.push({
        id: `curated:${ev.key}:${d}`,
        league,
        kind: 'placeholder',
        name: ev.name,
        importance: ev.importance,
        // Midnight Eastern: the same placeholder time ESPN uses for an
        // unannounced start, so it buckets onto this date.
        startIso: `${d}T05:00:00.000Z`,
        timeKnown: false,
        timeApprox: false,
        home: NO_TEAM,
        away: NO_TEAM,
        neutral: true,
        city: ev.city ?? null,
        venueState: ev.venueState ?? null,
        broadcasts: { national: [], home: [], away: [] },
        postseason: true,
        national: true,
        expected: true,
      })
    }
  }
  return games
}

// Drop a curated placeholder once ESPN lists a postseason game (or event)
// in the same league on the same Eastern date: the real thing has arrived.
export function withoutSuperseded(curated: Game[], espn: Game[]): Game[] {
  const have = new Set(
    espn
      .filter((g) => !g.expected && (g.postseason || g.kind === 'event'))
      .map((g) => `${g.league.key}|${zonedParts(new Date(g.startIso), 'America/New_York').ymd}`)
  )
  return curated.filter((g) => !have.has(`${g.league.key}|${zonedParts(new Date(g.startIso), 'America/New_York').ymd}`))
}
