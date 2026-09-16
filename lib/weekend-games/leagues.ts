// The leagues the Wednesday "Planning on an Open House this weekend?" email
// covers, as ESPN scoreboard paths. Approved by Dave 2026-09-13: pro leagues
// plus college football always; college basketball only when it matters
// (a Top 25 team or the NCAA Tournament). Keep in step with
// scripts/build-team-states.mjs, which maps each league's teams to states.

export type Sport = 'football' | 'baseball' | 'basketball' | 'hockey' | 'soccer'

export type LeagueDef = {
  key: string // ESPN path under /sports/, also the team-states.json key
  group?: string // ESPN "groups" filter (80 = FBS, 50 = Division I)
  sport: Sport
  college: boolean
  // Typical length, for the hour-by-hour game meter.
  durationMin: number
  // Starting weight when picking each day's "Big one" (see plan.ts).
  importance: number
  // College hoops has hundreds of games a weekend: keep only ranked teams
  // and the NCAA Tournament.
  onlyWhenItMatters?: boolean
  // If ESPN can't serve this league one week, the email still goes out
  // without it (and the team gets a warning). Leagues without this flag are
  // required: a lineup missing the NFL or college football is worse than
  // no email, so the run stops instead.
  optional?: boolean
}

export const LEAGUES: LeagueDef[] = [
  { key: 'football/nfl', sport: 'football', college: false, durationMin: 195, importance: 100 },
  { key: 'football/college-football', group: '80', sport: 'football', college: true, durationMin: 210, importance: 50 },
  { key: 'baseball/mlb', sport: 'baseball', college: false, durationMin: 180, importance: 30 },
  { key: 'basketball/nba', sport: 'basketball', college: false, durationMin: 150, importance: 55 },
  { key: 'hockey/nhl', sport: 'hockey', college: false, durationMin: 150, importance: 45 },
  { key: 'basketball/wnba', sport: 'basketball', college: false, durationMin: 120, importance: 35, optional: true },
  { key: 'soccer/usa.1', sport: 'soccer', college: false, durationMin: 120, importance: 30, optional: true },
  { key: 'basketball/mens-college-basketball', group: '50', sport: 'basketball', college: true, durationMin: 120, importance: 40, onlyWhenItMatters: true, optional: true },
  { key: 'basketball/womens-college-basketball', group: '50', sport: 'basketball', college: true, durationMin: 120, importance: 40, onlyWhenItMatters: true, optional: true },
]

export const SPORT_EMOJI: Record<Sport, string> = {
  football: '🏈',
  baseball: '⚾',
  basketball: '🏀',
  hockey: '🏒',
  soccer: '⚽',
}

// verb: "Wide open until the Aggies kick off at 2:30 PM."
// late: "Whoever walks in during the 4th quarter really wants the house."
export const SPORT_WORDS: Record<Sport, { verb: string; late: string }> = {
  football: { verb: 'kick off', late: 'the 4th quarter' },
  baseball: { verb: 'take the field', late: 'the 7th-inning stretch' },
  basketball: { verb: 'tip off', late: 'the second half' },
  hockey: { verb: 'drop the puck', late: 'the 3rd period' },
  soccer: { verb: 'kick off', late: 'the second half' },
}
