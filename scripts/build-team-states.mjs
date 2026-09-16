// Regenerates lib/weekend-games/team-states.json: which US state each team
// calls home, per ESPN league. The Wednesday weekend-games email needs it to
// list a state's teams when they play AWAY (fans are still home watching),
// and as a fallback when a scoreboard venue has no state (some MLS rows).
//
// ESPN doesn't expose a college team's home state directly, so this reads a
// season and more of scoreboards and takes each team's most common venue
// state across its non-neutral home games. Run it once a year, before the
// football season (teams rarely move, but they do — the A's, Utah's NHL team):
//
//   node scripts/build-team-states.mjs
//
// Each league is scanned from the start of its 2025 season through today, so
// brand-new teams (2026 expansion) are picked up from their first home games.
// Keep LEAGUES in step with lib/weekend-games/leagues.ts.

import { writeFileSync } from 'node:fs'

const LEAGUES = [
  { key: 'football/nfl', from: '2025-09-04' },
  { key: 'football/college-football', group: '80', from: '2025-08-23' },
  { key: 'baseball/mlb', from: '2025-03-27' },
  { key: 'basketball/nba', from: '2025-10-21' },
  { key: 'hockey/nhl', from: '2025-10-07' },
  { key: 'basketball/wnba', from: '2025-05-16' },
  { key: 'soccer/usa.1', from: '2025-02-22' },
  { key: 'basketball/mens-college-basketball', group: '50', from: '2025-11-03' },
  { key: 'basketball/womens-college-basketball', group: '50', from: '2025-11-03' },
  { key: 'soccer/usa.nwsl', from: '2025-03-14' }, // planner only (see leagues.ts)
]

const LIMIT = 1000

// Teams ESPN lists without a usable stadium address, checked by hand. FC Dallas
// plays at "Toyota Stadium, USA": no city, no state.
const OVERRIDES = {
  'soccer/usa.1': { 185: { s: 'TX', n: 'FC Dallas' } },
}

const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

function stateCode(raw) {
  const v = (raw || '').trim().toUpperCase()
  if (!v) return null
  if (US_STATES[v]) return v
  if (v === 'WASHINGTON, DC' || v === 'WASHINGTON DC') return 'DC'
  const hit = Object.entries(US_STATES).find(([, name]) => name.toUpperCase() === v)
  return hit ? hit[0] : null
}

// Same rule the runtime uses: the venue's state, or the tail of "City, State"
// when ESPN packs both into the city field.
function venueState(address) {
  if (!address) return null
  const direct = stateCode(address.state)
  if (direct) return direct
  const city = address.city || ''
  const comma = city.lastIndexOf(',')
  return comma >= 0 ? stateCode(city.slice(comma + 1)) : null
}

const NON_US = 'non-US'
const ALL_STAR_NAME = /^(Team|USA|World) |All-?Stars?/i

// A venue that is clearly outside the US: a non-US country, or a state field
// that isn't a US state ("ON", "British Columbia"). A US venue with a
// garbled address (no state at all) doesn't count.
function isForeign(address) {
  if (!address) return false
  const country = String(address.country || '').trim()
  if (country && !/^(USA?|United States)$/i.test(country)) return true
  return !!String(address.state || '').trim()
}

function ymd(d) {
  return d.toISOString().slice(0, 10).replaceAll('-', '')
}

function weeklyWindows(from, to) {
  const out = []
  const end = new Date(`${to}T00:00:00Z`)
  for (let d = new Date(`${from}T00:00:00Z`); d <= end; d = new Date(d.getTime() + 7 * 864e5)) {
    const last = new Date(Math.min(d.getTime() + 6 * 864e5, end.getTime()))
    out.push(`${ymd(d)}-${ymd(last)}`)
  }
  return out
}

async function fetchJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      if (attempt >= 3) throw new Error(`${url}: ${e.message}`)
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }
}

const result = {}
for (const league of LEAGUES) {
  const votes = new Map() // teamId -> { name, counts: Map<state, n> }
  const unplaced = new Map() // teamId -> name, home games with no usable address
  let events = 0
  for (const window of weeklyWindows(league.from, new Date().toISOString().slice(0, 10))) {
    const params = new URLSearchParams({ dates: window, limit: String(LIMIT) })
    if (league.group) params.set('groups', league.group)
    const url = `https://site.api.espn.com/apis/site/v2/sports/${league.key}/scoreboard?${params}`
    const data = await fetchJson(url)
    const list = data.events || []
    if (list.length >= LIMIT) console.warn(`  ! ${league.key} ${window} hit the ${LIMIT} limit`)
    events += list.length
    for (const ev of list) {
      const comp = ev.competitions?.[0]
      // Preseason is played away from home (spring training in Florida and
      // Arizona), so it doesn't vote.
      if (!comp || comp.neutralSite || ev.season?.type === 1) continue
      const home = comp.competitors?.find((c) => c.homeAway === 'home')
      if (!home?.team?.id) continue
      // Canadian home games vote too, so a Toronto team never becomes a US one.
      const vote = venueState(comp.venue?.address) ?? (isForeign(comp.venue?.address) ? NON_US : null)
      if (!vote) {
        unplaced.set(home.team.id, home.team.displayName)
        continue
      }
      const v = votes.get(home.team.id) ?? { name: home.team.displayName, counts: new Map() }
      v.counts.set(vote, (v.counts.get(vote) ?? 0) + 1)
      votes.set(home.team.id, v)
    }
  }
  const teams = {}
  for (const [id, v] of [...votes].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const [state, homeGames] = [...v.counts].sort((a, b) => b[1] - a[1])[0]
    // All-Star squads ("Team Stars", "MLS All-Stars") host a game or three a
    // year; real teams host dozens.
    if (state === NON_US || homeGames < 3 || ALL_STAR_NAME.test(v.name)) continue
    teams[id] = { s: state, n: v.name }
  }
  Object.assign(teams, OVERRIDES[league.key] ?? {})
  for (const [id, name] of unplaced) {
    if (!teams[id] && !votes.has(id)) {
      console.warn(`  ? ${league.key}: ${name} (${id}) has home games with no stadium state. If it's a US team, add it to OVERRIDES.`)
    }
  }
  result[league.key] = teams
  console.log(`${league.key}: ${events} games scanned, ${Object.keys(teams).length} US teams`)
}

const outPath = new URL('../lib/weekend-games/team-states.json', import.meta.url)
writeFileSync(outPath, JSON.stringify(result, null, 1) + '\n')
console.log(`wrote ${outPath.pathname}`)
