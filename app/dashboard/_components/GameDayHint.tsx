'use client'
import { useEffect, useMemo, useState } from 'react'
import { normalizeStateCode } from '@/lib/hardware-offer'
import type { Game } from '@/lib/weekend-games/espn'
import { buildDayPlan, METER_START_HOUR } from '@/lib/weekend-games/plan'
import { STATE_TIME_ZONES, meterHourLabel } from '@/lib/weekend-games/time'
import { fromWire, type PlannerResponse } from '@/lib/planner/rows'

// A card under Property Details on the New Open House form: what's on TV
// that day in the property's state, from the same schedule and rules as
// /planner. Appears once the address and the date are both in; the chosen
// hours are outlined on the meter so the agent sees what they're up against
// before they save. US properties only (the schedule is US leagues).

const METER_COLORS = ['#d6ecd9', '#f6e3b8', '#f2c98a', '#e8907a']
const MUTED = '#6e6e73'

function minutesOf(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export default function GameDayHint({
  address,
  state,
  country,
  dateIso,
  startTime,
  endTime,
  timeZone,
}: {
  address: string
  state: string
  country: string
  dateIso: string
  startTime: string
  endTime: string
  timeZone: string
}) {
  const code = country && country !== 'US' ? null : normalizeStateCode(state)
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dateIso)
  const key = code && dateOk && address.trim() ? `${code}|${dateIso}` : null
  const [cache, setCache] = useState<Record<string, Game[] | 'error'>>({})

  useEffect(() => {
    if (!key || cache[key]) return
    const [st, day] = key.split('|')
    let cancelled = false
    fetch(`/api/planner?state=${st}&from=${day}&to=${day}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as PlannerResponse
      })
      .then((body) => {
        if (cancelled) return
        const games = body.games.map(fromWire).filter((g): g is Game => g !== null)
        setCache((c) => ({ ...c, [key]: games }))
      })
      .catch(() => {
        if (!cancelled) setCache((c) => ({ ...c, [key]: 'error' }))
      })
    return () => {
      cancelled = true
    }
  }, [key, cache])

  const games = key ? cache[key] : undefined
  const tz = timeZone || (code ? STATE_TIME_ZONES[code] : '') || 'America/New_York'
  const plan = useMemo(
    () => (code && dateOk && Array.isArray(games) ? buildDayPlan({ games, state: code, timeZone: tz, ymd: dateIso }) : null),
    [code, dateOk, games, tz, dateIso]
  )

  if (!key || games === 'error' || !plan) return null

  const start = minutesOf(startTime)
  const end = minutesOf(endTime)
  const chosen = (i: number) => {
    if (start === null || end === null || end <= start) return false
    const h = METER_START_HOUR + i
    return h * 60 < end && (h + 1) * 60 > start
  }
  const busy = plan.rows.length + plan.afterHours.length + plan.tba.length
  const link = `/planner?state=${code}&date=${dateIso}`

  return (
    <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f' }}>Game Day Check</span>
        <span style={{ fontSize: '11px', color: MUTED }}>{plan.weekdayName}, {plan.dateText}</span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1d1d1f', lineHeight: 1.4 }}>
        {plan.total === 0 ? 'Coast is clear. Not a single game on the schedule.' : plan.headline}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${plan.meter.length}, minmax(0, 1fr))`, gap: '3px', marginTop: '8px' }}>
        {plan.meter.map((count, i) => (
          <div
            key={i}
            title={`${count} game${count === 1 ? '' : 's'} on`}
            style={{
              height: '18px',
              background: METER_COLORS[Math.min(count, METER_COLORS.length - 1)],
              borderRadius: i === 0 ? '5px 0 0 5px' : i === plan.meter.length - 1 ? '0 5px 5px 0' : 0,
              boxShadow: chosen(i) ? 'inset 0 0 0 2px #1d1d1f' : undefined,
            }}
          />
        ))}
        {plan.meter.map((_, i) => (
          <div key={`l${i}`} style={{ fontSize: '10px', color: MUTED, textAlign: 'center' }}>{meterHourLabel(METER_START_HOUR + i)}</div>
        ))}
      </div>
      <div style={{ fontSize: '12px', color: MUTED, marginTop: '6px', lineHeight: 1.5 }}>
        {plan.total > 0 && (
          <>
            🏡 <strong style={{ color: '#1d1d1f' }}>{plan.sweetSpot.label}:</strong> {plan.sweetSpot.text}.{' '}
          </>
        )}
        {start !== null && end !== null && end > start ? 'Your hours are outlined. ' : ''}
        {busy > 0 ? `${busy} game${busy === 1 ? '' : 's'} that day. ` : ''}
        <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: '#c9963a', fontWeight: 600 }}>
          Full day in the Game-Day Planner →
        </a>
      </div>
    </div>
  )
}
