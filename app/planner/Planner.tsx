'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { US_STATES } from '@/lib/hardware-offer'
import { LEAGUES, SPORT_EMOJI, type LeagueDef } from '@/lib/weekend-games/leagues'
import type { Game } from '@/lib/weekend-games/espn'
import { buildDayPlan, daySummary, METER_START_HOUR, type DayPlan, type PlannedGame } from '@/lib/weekend-games/plan'
import { STATE_TIME_ZONES, addDays, dateLabel, meterHourLabel, timeZoneLabel, zonedParts } from '@/lib/weekend-games/time'
import { fromWire, type PlannerResponse } from '@/lib/planner/rows'

// The public game-day planner. All the planning rules live in
// lib/weekend-games/plan.ts (shared with the Wednesday email); this file is
// the calendar, the league toggles and the day panel around them. Schedule
// data comes from /api/planner one month at a time and is cached per
// state+month for the visit.

const GOLD = '#c9963a'
const MUTED = '#6e6e73'
const RULE = '#e5e5ea'
const BIG_RED = '#b4533a'
const METER_COLORS = ['#d6ecd9', '#f6e3b8', '#f2c98a', '#e8907a']
const STORAGE_KEY = 'oha-planner-v1'
const MONTHS_AHEAD = 12
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

type MonthData = { games: Game[]; refreshedAt: string | null; horizon: string | null }

type Group = { title: string; leagues: LeagueDef[] }
const GROUPS: Group[] = [
  { title: 'Pro', leagues: LEAGUES.filter((l) => l.kind === 'game' && !l.college) },
  { title: 'College', leagues: LEAGUES.filter((l) => l.college) },
  { title: 'Events', leagues: LEAGUES.filter((l) => l.kind === 'event') },
]

function monthOf(ymd: string): string {
  return ymd.slice(0, 7)
}

function firstOfMonth(month: string): string {
  return `${month}-01`
}

function nextMonth(month: string, step = 1): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + step, 1))
  return d.toISOString().slice(0, 7)
}

function lastOfMonth(month: string): string {
  return addDays(firstOfMonth(nextMonth(month)), -1)
}

function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

function weekdayIndex(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

// Today, then the coming Saturday: the day most agents are planning for.
function defaultSelection(today: string): string {
  const wd = weekdayIndex(today)
  if (wd === 6 || wd === 0) return today
  return addDays(today, 6 - wd)
}

function loadPrefs(): { state?: string; off?: string[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePrefs(p: { state: string; off: string[] }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* private mode, storage full: the page works without it */
  }
}

function refreshedLabel(iso: string | null): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso))
}

export default function Planner({ initialState }: { initialState: string }) {
  const [state, setState] = useState(initialState)
  const [off, setOff] = useState<Set<string>>(new Set())
  const [hydrated, setHydrated] = useState(false)
  const timeZone = STATE_TIME_ZONES[state] ?? 'America/New_York'
  const today = zonedParts(new Date(), timeZone).ymd
  const [month, setMonth] = useState(() => monthOf(defaultSelection(today)))
  const [selected, setSelected] = useState(() => defaultSelection(today))
  const [cache, setCache] = useState<Record<string, MonthData>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Saved state and toggles win over the geo guess, but never over an
  // explicit ?state= in the link.
  useEffect(() => {
    // After paint (a microtask), so the server-rendered markup hydrates
    // untouched and the saved preferences apply in one render.
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      const prefs = loadPrefs()
      const linked = new URLSearchParams(window.location.search).get('state')
      if (!linked && prefs.state && US_STATES[prefs.state]) setState(prefs.state)
      if (prefs.off) setOff(new Set(prefs.off.filter((k) => LEAGUES.some((l) => l.key === k))))
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    savePrefs({ state, off: [...off] })
    const url = new URL(window.location.href)
    url.searchParams.set('state', state)
    window.history.replaceState(null, '', url.toString())
  }, [state, off, hydrated])

  const cacheKey = `${state}|${month}`
  const data = cache[cacheKey]
  const error = errors[cacheKey] ?? null
  const loading = !data && !error

  useEffect(() => {
    if (cache[cacheKey] || errors[cacheKey]) return
    let cancelled = false
    const from = firstOfMonth(month)
    const to = lastOfMonth(month)
    fetch(`/api/planner?state=${state}&from=${from}&to=${to}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as PlannerResponse
      })
      .then((body) => {
        if (cancelled) return
        const games = body.games.map(fromWire).filter((g): g is Game => g !== null)
        setCache((c) => ({ ...c, [cacheKey]: { games, refreshedAt: body.refreshedAt, horizon: body.horizon } }))
      })
      .catch((e) => {
        if (!cancelled) setErrors((prev) => ({ ...prev, [cacheKey]: e instanceof Error ? e.message : String(e) }))
      })
    return () => {
      cancelled = true
    }
  }, [cacheKey, state, month, cache, errors])

  const visibleGames = useMemo(
    () => (data?.games ?? []).filter((g) => !off.has(g.league.key)),
    [data, off]
  )

  // A plan for every day of the month, so the calendar can shade each cell.
  const plans = useMemo(() => {
    const out: Record<string, DayPlan> = {}
    for (let d = firstOfMonth(month); d <= lastOfMonth(month); d = addDays(d, 1)) {
      out[d] = buildDayPlan({ games: visibleGames, state, timeZone, ymd: d })
    }
    return out
  }, [visibleGames, state, timeZone, month])

  const selectedPlan = monthOf(selected) === month ? plans[selected] : undefined
  const horizon = data?.horizon ?? null
  const minMonth = monthOf(today)
  const maxMonth = nextMonth(minMonth, MONTHS_AHEAD)

  const toggle = useCallback((key: string) => {
    setOff((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const setAll = useCallback((on: boolean) => {
    setOff(on ? new Set() : new Set(LEAGUES.map((l) => l.key)))
  }, [])

  const goMonth = (step: number) => {
    const next = nextMonth(month, step)
    if (next < minMonth || next > maxMonth) return
    setMonth(next)
    // Keep a day selected in the month being viewed.
    const first = next === minMonth ? today : firstOfMonth(next)
    setSelected(first)
  }

  const changeState = (next: string) => {
    setState(next)
  }

  // Calendar cells: leading blanks so the 1st lands on its weekday.
  const cells: (string | null)[] = []
  for (let i = 0; i < weekdayIndex(firstOfMonth(month)); i++) cells.push(null)
  for (let d = firstOfMonth(month); d <= lastOfMonth(month); d = addDays(d, 1)) cells.push(d)

  const tzText = timeZoneLabel(timeZone)

  return (
    <div className="pl">
      <style>{`
        .pl { --gold: ${GOLD}; }
        .pl * { box-sizing: border-box; }
        .pl-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; justify-content: center; margin-bottom: 14px; }
        .pl-select { font: inherit; font-size: 15px; font-weight: 600; padding: 9px 36px 9px 12px; border: 1px solid ${RULE}; border-radius: 10px; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%236e6e73' stroke-width='1.6'/%3E%3C/svg%3E") no-repeat right 12px center; appearance: none; color: #1d1d1f; }
        .pl-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; align-items: center; margin-bottom: 6px; }
        .pl-group { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: ${MUTED}; margin: 0 4px 0 10px; }
        .pl-chip { font: inherit; font-size: 13px; font-weight: 600; padding: 6px 11px; border-radius: 999px; border: 1px solid ${RULE}; background: #fff; color: #1d1d1f; cursor: pointer; transition: all .15s; }
        .pl-chip.on { background: #1d1d1f; border-color: #1d1d1f; color: #fff; }
        .pl-chip:hover { border-color: ${GOLD}; }
        .pl-chip-all { font: inherit; font-size: 12px; color: ${MUTED}; background: none; border: none; cursor: pointer; text-decoration: underline; padding: 4px 6px; }
        .pl-body { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 20px; margin-top: 18px; align-items: start; }
        .pl-cal { border: 1px solid ${RULE}; border-radius: 16px; padding: 16px; }
        .pl-cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .pl-cal-title { font-size: 18px; font-weight: 700; }
        .pl-nav { font: inherit; font-size: 18px; width: 34px; height: 34px; border-radius: 10px; border: 1px solid ${RULE}; background: #fff; cursor: pointer; }
        .pl-nav:disabled { opacity: .35; cursor: default; }
        .pl-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
        .pl-wd { font-size: 11px; font-weight: 700; color: ${MUTED}; text-align: center; text-transform: uppercase; letter-spacing: .5px; padding-bottom: 4px; }
        .pl-cell { position: relative; aspect-ratio: 1 / 0.95; border-radius: 10px; border: 1px solid transparent; background: #f5f5f7; font: inherit; cursor: pointer; padding: 6px; text-align: left; display: flex; flex-direction: column; justify-content: space-between; color: #1d1d1f; }
        .pl-cell:hover { border-color: ${GOLD}; }
        .pl-cell.sel { border-color: #1d1d1f; box-shadow: 0 0 0 1px #1d1d1f inset; }
        .pl-cell.past { opacity: .45; }
        .pl-cell.beyond { background: repeating-linear-gradient(135deg, #f5f5f7 0 6px, #ececee 6px 12px); }
        .pl-cell.blank { background: transparent; cursor: default; }
        .pl-num { font-size: 13px; font-weight: 700; }
        .pl-cell.today .pl-num { color: ${GOLD}; }
        .pl-marks { display: flex; gap: 3px; align-items: center; font-size: 10px; color: ${MUTED}; font-weight: 600; }
        .pl-dot { width: 7px; height: 7px; border-radius: 50%; background: ${BIG_RED}; display: inline-block; }
        .pl-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: ${MUTED}; margin-top: 12px; }
        .pl-sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; vertical-align: -1px; margin-right: 5px; }
        .pl-day { border: 1px solid ${RULE}; border-radius: 16px; padding: 18px; }
        .pl-day-date { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: ${GOLD}; }
        .pl-day-head { font-size: 20px; font-weight: 700; line-height: 1.3; margin: 4px 0 12px; }
        .pl-meter { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 3px; }
        .pl-meter-cell { height: 26px; }
        .pl-meter-cell.dusk { background-image: repeating-linear-gradient(135deg, rgba(0,0,0,.06) 0 4px, transparent 4px 8px); }
        .pl-meter-lab { font-size: 11px; color: ${MUTED}; text-align: center; padding-top: 4px; }
        .pl-note { font-size: 13px; color: ${MUTED}; margin-top: 6px; line-height: 1.5; }
        .pl-spot { background: #eef6ef; border-radius: 12px; padding: 12px 14px; font-size: 14px; line-height: 1.6; margin-top: 14px; }
        .pl-rows { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
        .pl-rows td { padding: 9px 0; border-top: 1px solid ${RULE}; vertical-align: top; }
        .pl-rows tr.big td { background: #fff8f5; }
        .pl-time { width: 78px; font-weight: 700; white-space: nowrap; }
        .pl-emoji { width: 26px; padding-right: 6px; }
        .pl-detail { color: ${MUTED}; font-size: 13px; }
        .pl-big { font-size: 11px; font-weight: 700; color: ${BIG_RED}; text-transform: uppercase; letter-spacing: .5px; margin-left: 6px; }
        .pl-sub { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: ${MUTED}; margin: 18px 0 4px; }
        .pl-list { font-size: 13px; line-height: 1.7; color: #48484a; }
        .pl-cta { display: inline-block; background: ${GOLD}; color: #1d1d1f; padding: 11px 22px; border-radius: 10px; font-size: 14px; font-weight: 700; text-decoration: none; margin-top: 18px; }
        .pl-status { font-size: 13px; color: ${MUTED}; text-align: center; padding: 10px; }
        .pl-empty { font-size: 14px; color: ${MUTED}; line-height: 1.6; }
        @media (max-width: 820px) {
          .pl-body { grid-template-columns: 1fr; }
          .pl-cell { padding: 4px; aspect-ratio: 1 / 1; }
          .pl-num { font-size: 12px; }
        }
      `}</style>

      <div className="pl-controls">
        <label style={{ fontSize: '14px', color: MUTED, fontWeight: 600 }}>
          Your state{' '}
          <select className="pl-select" value={state} onChange={(e) => changeState(e.target.value)} aria-label="State">
            {Object.entries(US_STATES)
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
          </select>
        </label>
        <span style={{ fontSize: '13px', color: MUTED }}>Times are {tzText}</span>
      </div>

      <div className="pl-chips">
        {GROUPS.map((g) => (
          <span key={g.title} style={{ display: 'contents' }}>
            <span className="pl-group">{g.title}</span>
            {g.leagues.map((l) => (
              <button
                key={l.key}
                type="button"
                className={`pl-chip${off.has(l.key) ? '' : ' on'}`}
                aria-pressed={!off.has(l.key)}
                onClick={() => toggle(l.key)}
              >
                {SPORT_EMOJI[l.sport]} {l.label}
              </button>
            ))}
          </span>
        ))}
        <button type="button" className="pl-chip-all" onClick={() => setAll(true)}>all</button>
        <button type="button" className="pl-chip-all" onClick={() => setAll(false)}>none</button>
      </div>

      <div className="pl-body">
        <div className="pl-cal">
          <div className="pl-cal-head">
            <button type="button" className="pl-nav" onClick={() => goMonth(-1)} disabled={month <= minMonth} aria-label="Previous month">‹</button>
            <div className="pl-cal-title">{monthTitle(month)}</div>
            <button type="button" className="pl-nav" onClick={() => goMonth(1)} disabled={month >= maxMonth} aria-label="Next month">›</button>
          </div>
          <div className="pl-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="pl-wd">{d}</div>
            ))}
            {cells.map((ymd, i) => {
              if (!ymd) return <div key={`b${i}`} className="pl-cell blank" />
              const plan = plans[ymd]
              const sum = daySummary(plan)
              const past = ymd < today
              const beyond = !!horizon && ymd > horizon
              const cls = ['pl-cell', ymd === selected ? 'sel' : '', past ? 'past' : '', ymd === today ? 'today' : '', beyond ? 'beyond' : ''].filter(Boolean).join(' ')
              const bg = beyond || !data ? undefined : METER_COLORS[sum.heat]
              return (
                <button key={ymd} type="button" className={cls} style={bg ? { background: bg } : undefined} onClick={() => setSelected(ymd)} aria-label={`${plan.weekdayName} ${dateLabel(ymd)}`}>
                  <span className="pl-num">{Number(ymd.slice(8))}</span>
                  <span className="pl-marks">
                    {sum.big && <span className="pl-dot" title="Big one" />}
                    {sum.tba + sum.expected > 0 && <span>TBA</span>}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="pl-legend">
            <span><span className="pl-sw" style={{ background: METER_COLORS[0] }} />Coast is clear</span>
            <span><span className="pl-sw" style={{ background: METER_COLORS[2] }} />A game or two</span>
            <span><span className="pl-sw" style={{ background: METER_COLORS[3] }} />Game-day chaos</span>
            <span><span className="pl-dot" style={{ marginRight: 5 }} />Big one</span>
            <span><span className="pl-sw" style={{ background: 'repeating-linear-gradient(135deg, #f5f5f7 0 3px, #dcdce0 3px 6px)' }} />Not published yet</span>
          </div>
          {loading && <div className="pl-status">Loading the schedule…</div>}
          {error && (
            <div className="pl-status">
              Couldn&rsquo;t load the schedule ({error}).{' '}
              <button type="button" className="pl-chip-all" onClick={() => setErrors((prev) => { const next = { ...prev }; delete next[cacheKey]; return next })}>Try again</button>
            </div>
          )}
          {!loading && !error && data && !data.refreshedAt && (
            <div className="pl-status">The schedule hasn&rsquo;t been loaded yet. Check back shortly.</div>
          )}
        </div>

        <div className="pl-day">
          {selectedPlan ? (
            <DayPanel plan={selectedPlan} beyond={!!horizon && selected > horizon} refreshedAt={data?.refreshedAt ?? null} tzText={tzText} />
          ) : (
            <div className="pl-empty">Pick a day on the calendar.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function Meter({ plan }: { plan: DayPlan }) {
  const dusk = new Set(plan.duskHours)
  return (
    <div>
      <div className="pl-meter">
        {plan.meter.map((count, i) => (
          <div
            key={i}
            className={`pl-meter-cell${dusk.has(i) ? ' dusk' : ''}`}
            style={{
              background: METER_COLORS[Math.min(count, METER_COLORS.length - 1)],
              borderRadius: i === 0 ? '5px 0 0 5px' : i === plan.meter.length - 1 ? '0 5px 5px 0' : 0,
            }}
            title={`${count} game${count === 1 ? '' : 's'} on`}
          />
        ))}
      </div>
      <div className="pl-meter">
        {plan.meter.map((_, i) => (
          <div key={i} className="pl-meter-lab">{meterHourLabel(METER_START_HOUR + i)}</div>
        ))}
      </div>
      {plan.sun && (
        <div className="pl-note">
          ☀️ Sunrise {plan.sun.sunriseText} · 🌇 Sunset {plan.sun.sunsetText}
          {plan.duskHours.length ? ' · hatched hours end after sunset' : ''}
        </div>
      )}
    </div>
  )
}

function Row({ p, big }: { p: PlannedGame; big: boolean }) {
  return (
    <tr className={big ? 'big' : undefined}>
      <td className="pl-time">{p.timeText}</td>
      <td className="pl-emoji">{SPORT_EMOJI[p.game.league.sport]}</td>
      <td>
        <strong>{p.matchup}</strong>
        {big && <span className="pl-big">Big one</span>}
        {p.detail && <div className="pl-detail">{p.detail}</div>}
      </td>
    </tr>
  )
}

function short(p: PlannedGame): string {
  const bits = [p.matchup, p.tv].filter(Boolean)
  return bits.join(' · ')
}

function DayPanel({ plan, beyond, refreshedAt, tzText }: { plan: DayPlan; beyond: boolean; refreshedAt: string | null; tzText: string }) {
  const updated = refreshedLabel(refreshedAt)
  return (
    <div>
      <div className="pl-day-date">{plan.weekdayName} · {plan.dateText}</div>
      <div className="pl-day-head">{plan.headline}</div>

      {beyond ? (
        <div className="pl-empty">
          ESPN hasn&rsquo;t published the schedule this far ahead yet. Only events we know are coming are listed below, with details to follow.
        </div>
      ) : (
        <>
          <Meter plan={plan} />
          <div className="pl-spot">
            🏡 <strong>{plan.sweetSpot.label}:</strong> {plan.sweetSpot.text}.{plan.goBold ? ` ${plan.goBold}` : ''}
          </div>
          {plan.rows.length > 0 && (
            <table className="pl-rows">
              <tbody>
                {plan.rows.map((p) => (
                  <Row key={p.game.id + p.game.league.key} p={p} big={p === plan.bigGame} />
                ))}
              </tbody>
            </table>
          )}
          {plan.moreDaytime > 0 && <div className="pl-note">+ {plan.moreDaytime} more daytime game{plan.moreDaytime === 1 ? '' : 's'}</div>}
          {plan.afterHours.length > 0 && (
            <>
              <div className="pl-sub">After 6 PM</div>
              <div className="pl-list">{plan.afterHours.map((p) => `${p.timeText} ${short(p)}`).join(' · ')}</div>
            </>
          )}
          {plan.tba.length > 0 && (
            <>
              <div className="pl-sub">Time TBA</div>
              <div className="pl-list">{plan.tba.map((p) => short(p)).join(' · ')}</div>
            </>
          )}
        </>
      )}

      {plan.expected.length > 0 && (
        <>
          <div className="pl-sub">Expected</div>
          <div className="pl-list">
            {plan.expected.map((p) => (
              <div key={p.game.id}>{SPORT_EMOJI[p.game.league.sport]} {p.matchup}{p.game.city ? ` · ${p.game.city}` : ''}</div>
            ))}
            <div className="pl-note" style={{ marginTop: 2 }}>Usual dates for these. Times and matchups are announced closer to the day.</div>
          </div>
        </>
      )}

      <a className="pl-cta" href="/dashboard?view=new">Create my open house →</a>
      <div className="pl-note" style={{ marginTop: 14 }}>
        Times are {tzText} and come from ESPN{updated ? `, last updated ${updated}` : ''}. Kickoffs sometimes move, so double-check before you print the sign.
      </div>
    </div>
  )
}
