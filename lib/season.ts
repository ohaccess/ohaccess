// Which season is it right now? Used to pick the homepage hero image.
//
// The boundaries are the real astronomical equinoxes and solstices, stored as
// exact UTC instants. An instant is one worldwide moment, so comparing the
// visitor's clock against it flips the season at the equinox/solstice in every
// timezone with no timezone math — and the server (UTC) and the visitor's
// browser agree, so there is no hydration mismatch.
export type Season = 'spring' | 'summer' | 'fall' | 'winter'

// [March equinox, June solstice, September equinox, December solstice] per year.
const TURNS: Record<number, [string, string, string, string]> = {
  2026: ['2026-03-20T14:46Z', '2026-06-21T08:24Z', '2026-09-23T00:05Z', '2026-12-21T20:50Z'],
  2027: ['2027-03-20T20:25Z', '2027-06-21T14:11Z', '2027-09-23T06:02Z', '2027-12-22T02:42Z'],
  2028: ['2028-03-20T02:17Z', '2028-06-20T20:02Z', '2028-09-22T11:45Z', '2028-12-21T08:19Z'],
  2029: ['2029-03-20T08:01Z', '2029-06-21T01:48Z', '2029-09-22T17:38Z', '2029-12-21T14:14Z'],
  2030: ['2030-03-20T13:51Z', '2030-06-21T07:31Z', '2030-09-22T23:27Z', '2030-12-21T20:09Z'],
  2031: ['2031-03-20T19:40Z', '2031-06-21T13:17Z', '2031-09-23T05:15Z', '2031-12-22T01:55Z'],
  2032: ['2032-03-20T01:21Z', '2032-06-20T19:08Z', '2032-09-22T11:11Z', '2032-12-21T07:55Z'],
  2033: ['2033-03-20T07:22Z', '2033-06-21T01:00Z', '2033-09-22T16:51Z', '2033-12-21T13:45Z'],
  2034: ['2034-03-20T13:17Z', '2034-06-21T06:44Z', '2034-09-22T22:39Z', '2034-12-21T19:33Z'],
  2035: ['2035-03-20T19:02Z', '2035-06-21T12:32Z', '2035-09-23T04:38Z', '2035-12-22T01:30Z'],
}

// Years past the table drift by at most a day; noon UTC on the typical date
// keeps the swap within hours of the true moment.
const fallbackTurns = (year: number): [number, number, number, number] => [
  Date.UTC(year, 2, 20, 12),
  Date.UTC(year, 5, 21, 12),
  Date.UTC(year, 8, 22, 12),
  Date.UTC(year, 11, 21, 12),
]

export function getSeason(now: number = Date.now()): Season {
  const year = new Date(now).getUTCFullYear()
  const row = TURNS[year]
  const [mar, jun, sep, dec] = row ? row.map(t => Date.parse(t)) : fallbackTurns(year)
  if (now < mar) return 'winter'
  if (now < jun) return 'spring'
  if (now < sep) return 'summer'
  if (now < dec) return 'fall'
  return 'winter'
}

export type Holiday = 'halloween' | 'christmas'

// Holiday hero windows: the seven days before the holiday plus the holiday
// itself — Oct 24–31 and Dec 18–25 — judged by the visitor's local calendar
// so the photo lasts through the holiday evening everywhere. Local-date logic
// can't run on the server (it only knows its own clock), so the component
// applies this after mount, on the visitor's device.
export function getHoliday(d: Date = new Date()): Holiday | null {
  const month = d.getMonth()
  const day = d.getDate()
  if (month === 9 && day >= 24) return 'halloween'
  if (month === 11 && day >= 18 && day <= 25) return 'christmas'
  return null
}

export const heroImage = (look: Season | Holiday) => `/record-hero-${look}.jpg`
