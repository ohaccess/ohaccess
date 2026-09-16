import { escapeHtml } from '../escape-html'
import { GOLD, ctaButton, greetingFor, shell, type BuiltEmail } from '../drip-emails'
import { SPORT_EMOJI, SPORT_WORDS } from './leagues'
import type { DayPlan, PlannedGame, WeekendPlan } from './plan'
import { METER_END_HOUR, METER_START_HOUR } from './plan'
import { meterHourLabel } from './time'

// The Wednesday "Planning on an Open House this weekend?" email. Design
// approved by Dave 2026-09-13 (mockup: real Texas games, Team "Dodge the
// Game" vs Team "Go Bold", game meter, sweet spot, "Big one" tags). Uses the
// drip shell, so it carries the same unsubscribe footer.

const e = escapeHtml
const MUTED = '#6e6e73'
const RULE = '#e5e5ea'
const BIG_RED = '#b4533a'
const AFTER_HOURS_NAMES = 8

const METER_COLORS = ['#d6ecd9', '#f6e3b8', '#f2c98a', '#e8907a']
// A meter hour that ends after sunset: same meaning, dimmed toward dusk.
const DUSK_COLORS = ['#b9c5c9', '#cfc3ae', '#c9ad86', '#bf7f6e']
function meterColor(count: number, dusk: boolean): string {
  return (dusk ? DUSK_COLORS : METER_COLORS)[Math.min(count, METER_COLORS.length - 1)]
}

function meterHtml(day: DayPlan): string {
  const { meter } = day
  const last = meter.length - 1
  const dusk = new Set(day.duskHours)
  const cells = meter
    .map((count, i) => {
      const radius = i === 0 ? 'border-radius:5px 0 0 5px;' : i === last ? 'border-radius:0 5px 5px 0;' : ''
      return `<td style="background:${meterColor(count, dusk.has(i))};height:26px;${radius}"></td>`
    })
    .join('')
  const labels = meter
    .map((_, i) => `<td style="padding-top:4px;">${meterHourLabel(METER_START_HOUR + i)}</td>`)
    .join('')
  const swatch = (color: string) =>
    `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${color};"></span>`
  const duskKey = dusk.size ? ` &nbsp;${swatch(DUSK_COLORS[0])} After sunset` : ''
  const sunLine = day.sun
    ? `<div style="font-size:12px;color:${MUTED};margin-top:4px;">☀️ Sunrise ${e(day.sun.sunriseText)} · 🌇 Sunset ${e(day.sun.sunsetText)}</div>`
    : ''
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:separate;border-spacing:3px 0;table-layout:fixed;">
    <tr>${cells}</tr>
    <tr style="font-size:11px;color:${MUTED};text-align:center;">${labels}</tr>
  </table>
  <div style="font-size:12px;color:${MUTED};margin-top:6px;">
    ${swatch(METER_COLORS[0])} Coast is clear &nbsp;
    ${swatch(METER_COLORS[2])} A game or two &nbsp;
    ${swatch(METER_COLORS[3])} Game-day chaos${duskKey}
  </div>
  ${sunLine}`
}

function gameRow(p: PlannedGame, isBig: boolean): string {
  const tag = isBig
    ? ` <span style="font-size:11px;font-weight:700;color:${BIG_RED};text-transform:uppercase;letter-spacing:0.5px;">Big one</span>`
    : ''
  return `
    <tr style="border-top:1px solid ${RULE};${isBig ? 'background:#fff8f5;' : ''}">
      <td style="padding:9px 0 9px ${isBig ? '6px' : '0'};width:78px;font-weight:700;white-space:nowrap;vertical-align:top;">${e(p.timeText)}</td>
      <td style="padding:9px 8px;width:22px;vertical-align:top;">${SPORT_EMOJI[p.game.league.sport]}</td>
      <td style="padding:9px 0;vertical-align:top;"><strong>${e(p.matchup)}</strong>${tag}${p.detail ? `<br/><span style="color:${MUTED};">${e(p.detail)}</span>` : ''}</td>
    </tr>`
}

function noteRow(label: string, icon: string, html: string): string {
  return `
    <tr style="border-top:1px solid ${RULE};">
      <td style="padding:9px 0;font-weight:700;white-space:nowrap;vertical-align:top;color:${MUTED};">${e(label)}</td>
      <td style="padding:9px 8px;vertical-align:top;">${icon}</td>
      <td style="padding:9px 0;vertical-align:top;color:${MUTED};">${html}</td>
    </tr>`
}

function afterHoursHtml(games: PlannedGame[]): string {
  const names = [...new Set(games.map((p) => p.stateTeam.short))]
  const shown = names.slice(0, AFTER_HOURS_NAMES).join(', ')
  const list = names.length > AFTER_HOURS_NAMES ? `${shown}, and more` : shown
  const count = `${games.length} more ${games.length === 1 ? 'game' : 'games'}`
  return `<strong style="color:#1d1d1f;">${count}</strong>: ${e(list)}. Your sign's already back in the trunk by then.`
}

function dayHtml(day: DayPlan): string {
  const rows = day.rows.map((p) => gameRow(p, p === day.bigGame))
  if (day.moreDaytime > 0) {
    rows.push(noteRow('', '➕', `Plus ${day.moreDaytime} smaller daytime ${day.moreDaytime === 1 ? 'game' : 'games'}.`))
  }
  if (day.afterHours.length) {
    rows.push(noteRow(`${METER_END_HOUR - 12} PM on`, '🌙', afterHoursHtml(day.afterHours)))
  }
  rows.push(...day.tba.map((p) => gameRow(p, false)))

  const table = rows.length
    ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse;font-size:13.5px;border-bottom:1px solid ${RULE};">
    ${rows.join('')}
  </table>`
    : ''

  return `
  <div style="margin-top:28px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${GOLD};">${e(day.weekdayName)} · ${e(day.dateText)}</div>
  <div style="font-size:18px;font-weight:700;margin-top:2px;line-height:1.3;">${e(day.headline)}</div>
  ${meterHtml(day)}
  <div style="margin-top:12px;background:#fbf5ea;border-radius:10px;padding:10px 14px;font-size:14px;">
    🏡 <strong>${e(day.sweetSpot.label)}:</strong> ${e(day.sweetSpot.text)}.${day.goBold ? ` ${e(day.goBold)}` : ''}
  </div>
  ${table}`
}

const TEAMS_HTML = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-collapse:collapse;">
    <tr>
      <td width="49%" style="background:#f5f5f7;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.5;vertical-align:top;">
        <strong>Team "Dodge the Game"</strong><br/>Schedule around kickoff. More foot traffic.
      </td>
      <td width="2%"></td>
      <td width="49%" style="background:#f5f5f7;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.5;vertical-align:top;">
        <strong>Team "Go Bold"</strong><br/>Open during the big game. Only serious buyers show.
      </td>
    </tr>
  </table>`

// The quiet version has no meters, so daylight gets its own two lines.
function quietSunHtml(plan: WeekendPlan): string {
  const days = [plan.saturday, plan.sunday].filter((d) => d.sun)
  if (!days.length) return ''
  return `
      <div style="font-size:12px;color:${MUTED};margin-top:10px;line-height:1.7;">
        ${days.map((d) => `${e(d.weekdayName)}: ☀️ Sunrise ${e(d.sun!.sunriseText)} · 🌇 Sunset ${e(d.sun!.sunsetText)}`).join('<br/>')}
      </div>`
}

// Under the button: the planner covers any day, not just this weekend.
function plannerLine(appUrl: string, stateCode: string): string {
  return `<div style="font-size:13px;color:${MUTED};margin-top:10px;">Looking at a different weekend? <a href="${e(appUrl)}/planner?state=${e(stateCode)}" style="color:${GOLD};font-weight:600;">Open the Game-Day Planner</a> for any day of the season.</div>`
}

function gameName(p: PlannedGame): string {
  if (p.game.league.sport === 'soccer') return p.stateTeam.short
  return p.game.league.college ? p.stateTeam.nickname : p.stateTeam.short
}

export function buildWeekendGamesEmail(o: {
  firstName?: string | null
  plan: WeekendPlan
  appUrl: string
  unsubscribeUrl: string
}): BuiltEmail {
  const { plan } = o
  const state = plan.stateName
  const dates = `Sat ${plan.saturday.dateText} & Sun ${plan.sunday.dateText}`
  const cta = ctaButton('Create my open house →', `${o.appUrl}/dashboard?view=new`)
  const opener = "It's Wednesday, so buyers are already planning their weekend."
  const quiet = plan.totalGames === 0

  let bodyHtml: string
  if (quiet) {
    bodyHtml = `
    <div style="font-size:14px;line-height:1.7;margin-top:10px;">
      ${e(opener)} Good news: there isn't a single ${e(state)} game to compete with this weekend.
    </div>
    <div style="margin-top:20px;background:#eef6ef;border-radius:12px;padding:18px;">
      <div style="font-size:20px;font-weight:700;">Coast is clear, ${e(state)}.</div>
      <div style="font-size:14px;line-height:1.7;margin-top:4px;">Every hour is a sweet spot. Pick your favorite and let's get it on the calendar.</div>
      ${quietSunHtml(plan)}
    </div>
    ${cta}
    ${plannerLine(o.appUrl, plan.stateCode)}
    <div style="font-size:14px;line-height:1.7;margin-top:18px;">
      P.S. No games means buyers have nowhere better to be. Maybe this is the weekend to hold two.
    </div>`
  } else {
    const big = plan.bigGame
    const soAre = big
      ? ` So ${big.game.league.sport === 'soccer' ? 'is' : 'are'} ${e(big.game.league.sport === 'soccer' ? big.stateTeam.short : `the ${gameName(big)}`)}.`
      : ''
    const ps = big
      ? `P.S. Scheduling right through the ${e(gameName(big))} game? Bold. We respect it. Whoever walks in during ${e(SPORT_WORDS[big.game.league.sport].late)} really wants the house.`
      : 'P.S. No blockbusters this weekend means buyers have nowhere better to be.'
    bodyHtml = `
    <div style="font-size:14px;line-height:1.7;margin-top:10px;">
      ${e(opener)}${soAre} Here's every ${e(state)} game this weekend, so you can pick your open house hours on purpose.
    </div>
    ${TEAMS_HTML}
    ${dayHtml(plan.saturday)}
    ${dayHtml(plan.sunday)}
    ${cta}
    ${plannerLine(o.appUrl, plan.stateCode)}
    <div style="font-size:14px;line-height:1.7;margin-top:18px;">${ps}</div>`
  }

  const firstSport = plan.bigGame?.game.league.sport
  return {
    subject: quiet
      ? `Planning on an Open House this weekend? The coast is clear in ${state}`
      : `Planning on an Open House this weekend? ${firstSport ? SPORT_EMOJI[firstSport] : '🏡'} Your ${state} game-day lineup`,
    html: shell({
      preheader: quiet
        ? `Not a single ${state} game this weekend. Every hour is a sweet spot.`
        : `${plan.saturday.headline} ${plan.sunday.headline}`,
      title: 'Planning on an Open House this weekend?',
      subtitle: quiet ? dates : `Your ${state} game-day lineup · ${dates}`,
      greeting: greetingFor(o.firstName),
      bodyHtml,
      unsubscribeUrl: o.unsubscribeUrl,
      footerNote: `Times are ${plan.timeZoneText} and come from ESPN. Kickoffs sometimes move, so double-check before you print the sign.`,
    }),
  }
}
