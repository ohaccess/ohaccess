// The leagues the Wednesday "Planning on an Open House this weekend?" email
// and the public /planner page cover, as ESPN scoreboard paths.
//
// Email (approved by Dave 2026-09-13): pro leagues plus college football
// always; college basketball only when it matters (a Top 25 team or the NCAA
// Tournament). The planner adds the event sports below (golf, racing, UFC,
// tennis majors, NWSL), flagged plannerOnly so the email's lineup is
// unchanged. Team leagues need team-states.json, built by
// scripts/build-team-states.mjs, which maps each league's teams to states.

export type Sport =
  | 'football'
  | 'baseball'
  | 'basketball'
  | 'hockey'
  | 'soccer'
  | 'golf'
  | 'racing'
  | 'mma'
  | 'tennis'
  | 'horse'

export type LeagueDef = {
  key: string // ESPN path under /sports/, also the team-states.json key
  label: string // planner toggle text
  group?: string // ESPN conference group: 80 = FBS, 50 = Division I
  sport: Sport
  college: boolean
  // 'game' = home team vs away team; 'event' = a tournament, race or card
  // with no teams (golf, racing, UFC, tennis), shown to every state.
  kind: 'game' | 'event'
  durationMin: number // how long a game keeps people on the couch
  importance: number // base score for the "Big one" pick
  // College hoops has hundreds of games a weekend: keep only ranked teams
  // and the NCAA Tournament.
  onlyWhenItMatters?: boolean
  // If ESPN can't serve this league one week, the email still goes out
  // without it (and the team gets a warning). Leagues without this flag are
  // required: a lineup missing the NFL or college football is worse than
  // none.
  optional?: boolean
  // In the planner only, never in the Wednesday email.
  plannerOnly?: boolean
  // How the planner's weekly refresh reads a whole season: one request per
  // month (ESPN caps a month at 500 games) or one per day (college
  // basketball has thousands of games a month; tennis tournaments span
  // weeks and only show up when asked for a day inside them).
  fetch?: 'month' | 'day'
}

export const LEAGUES: LeagueDef[] = [
  { key: 'football/nfl', label: 'NFL', sport: 'football', college: false, kind: 'game', durationMin: 195, importance: 100 },
  { key: 'football/college-football', label: 'College football', group: '80', sport: 'football', college: true, kind: 'game', durationMin: 210, importance: 50 },
  { key: 'baseball/mlb', label: 'MLB', sport: 'baseball', college: false, kind: 'game', durationMin: 180, importance: 30 },
  { key: 'basketball/nba', label: 'NBA', sport: 'basketball', college: false, kind: 'game', durationMin: 150, importance: 55 },
  { key: 'hockey/nhl', label: 'NHL', sport: 'hockey', college: false, kind: 'game', durationMin: 150, importance: 45 },
  { key: 'basketball/wnba', label: 'WNBA', sport: 'basketball', college: false, kind: 'game', durationMin: 120, importance: 35, optional: true },
  { key: 'soccer/usa.1', label: 'MLS', sport: 'soccer', college: false, kind: 'game', durationMin: 120, importance: 30, optional: true },
  { key: 'basketball/mens-college-basketball', label: "Men's college basketball", group: '50', sport: 'basketball', college: true, kind: 'game', durationMin: 120, importance: 40, onlyWhenItMatters: true, optional: true, fetch: 'day' },
  { key: 'basketball/womens-college-basketball', label: "Women's college basketball", group: '50', sport: 'basketball', college: true, kind: 'game', durationMin: 120, importance: 40, onlyWhenItMatters: true, optional: true, fetch: 'day' },
  // Planner only, from here down.
  { key: 'golf/pga', label: 'PGA Tour', sport: 'golf', college: false, kind: 'event', durationMin: 300, importance: 12, optional: true, plannerOnly: true },
  { key: 'racing/nascar-premier', label: 'NASCAR', sport: 'racing', college: false, kind: 'event', durationMin: 210, importance: 40, optional: true, plannerOnly: true },
  { key: 'racing/f1', label: 'Formula 1', sport: 'racing', college: false, kind: 'event', durationMin: 120, importance: 25, optional: true, plannerOnly: true },
  { key: 'racing/irl', label: 'IndyCar', sport: 'racing', college: false, kind: 'event', durationMin: 180, importance: 20, optional: true, plannerOnly: true },
  { key: 'mma/ufc', label: 'UFC', sport: 'mma', college: false, kind: 'event', durationMin: 360, importance: 25, optional: true, plannerOnly: true },
  { key: 'tennis/atp', label: 'Tennis majors', sport: 'tennis', college: false, kind: 'event', durationMin: 180, importance: 35, optional: true, plannerOnly: true, fetch: 'day' },
  { key: 'soccer/usa.nwsl', label: 'NWSL', sport: 'soccer', college: false, kind: 'game', durationMin: 120, importance: 15, optional: true, plannerOnly: true },
]

// The Wednesday email's lineup (unchanged since it was approved).
export const EMAIL_LEAGUES: LeagueDef[] = LEAGUES.filter((l) => !l.plannerOnly)

export function leagueByKey(key: string): LeagueDef | undefined {
  return LEAGUES.find((l) => l.key === key)
}

export const SPORT_EMOJI: Record<Sport, string> = {
  football: '🏈',
  baseball: '⚾',
  basketball: '🏀',
  hockey: '🏒',
  soccer: '⚽',
  golf: '⛳',
  racing: '🏁',
  mma: '🥊',
  tennis: '🎾',
  horse: '🏇',
}

// verb: "Wide open until the Aggies kick off at 2:30 PM."
// late: "Whoever walks in during the 4th quarter really wants the house."
export const SPORT_WORDS: Record<Sport, { verb: string; late: string }> = {
  football: { verb: 'kick off', late: 'the 4th quarter' },
  baseball: { verb: 'take the field', late: 'the 7th-inning stretch' },
  basketball: { verb: 'tip off', late: 'the second half' },
  hockey: { verb: 'drop the puck', late: 'the 3rd period' },
  soccer: { verb: 'kick off', late: 'the second half' },
  golf: { verb: 'tee off', late: 'the back nine' },
  racing: { verb: 'go green', late: 'the final laps' },
  mma: { verb: 'start', late: 'the main event' },
  tennis: { verb: 'start', late: 'the final set' },
  horse: { verb: 'start', late: 'the stretch run' },
}

// Event sports: which events count, and how big each one is. Returns the
// event's importance, or null to leave it out of the planner (a Tuesday
// Contender Series card, a tennis tournament that isn't a major).
const EVENT_RULES: Record<string, { skip?: RegExp; boosts: [RegExp, number][] }> = {
  'golf/pga': {
    boosts: [
      [/Masters/i, 70],
      [/PGA Championship/i, 65],
      [/U\.?S\.? Open/i, 65],
      [/Open Championship/i, 55],
      [/Ryder Cup|Presidents Cup/i, 60],
      [/Players Championship/i, 40],
      [/Tour Championship/i, 35],
    ],
  },
  'racing/nascar-premier': {
    boosts: [
      [/Daytona 500/i, 75],
      [/Coca-Cola 600|Championship/i, 50],
    ],
  },
  'racing/f1': { boosts: [[/United States|Miami|Las Vegas/i, 45]] },
  'racing/irl': { boosts: [[/Indianapolis 500|Indy 500/i, 75]] },
  'mma/ufc': { skip: /Contender Series|Road to UFC/i, boosts: [[/^UFC \d+/i, 40]] },
  'tennis/atp': { skip: /^(?!.*(Australian Open|French Open|Roland Garros|Wimbledon|US Open))/i, boosts: [[/./, 40]] },
}

export function eventImportance(league: LeagueDef, name: string): number | null {
  const rules = EVENT_RULES[league.key]
  if (!rules) return league.importance
  if (rules.skip?.test(name)) return null
  const boost = rules.boosts.find(([re]) => re.test(name))
  return boost ? boost[1] : league.importance
}

// Golf majors get four listed days; a regular tour stop only its weekend.
export function isGolfMajor(name: string): boolean {
  return eventImportance(LEAGUES.find((l) => l.key === 'golf/pga')!, name)! >= 55
}
