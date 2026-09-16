import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { US_STATES, normalizeStateCode } from '@/lib/hardware-offer'
import { curatedGames, withoutSuperseded } from '@/lib/planner/curated'
import { fromRow, toWire, type PlannerResponse, type SportsEventRow } from '@/lib/planner/rows'
import { addDays } from '@/lib/weekend-games/time'
import type { Game } from '@/lib/weekend-games/espn'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_RANGE_DAYS = 400
const YMD = /^\d{4}-\d{2}-\d{2}$/

// Public, no auth: the schedule for one state between two dates, from the
// sports_events table (never ESPN directly). Games played in the state, the
// state's teams playing away, everything national (playoffs, majors), plus
// the hand-kept "expected" placeholders. Cached at the CDN for 30 minutes.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const state = normalizeStateCode(params.get('state'))
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  if (!state || !US_STATES[state]) return NextResponse.json({ error: 'Unknown state' }, { status: 400 })
  if (!YMD.test(from) || !YMD.test(to) || to < from || addDays(from, MAX_RANGE_DAYS) < to) {
    return NextResponse.json({ error: 'Bad date range' }, { status: 400 })
  }

  const rows: SportsEventRow[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('sports_events')
      .select('*')
      .gte('day_et', from)
      .lte('day_et', to)
      .or(`national.eq.true,venue_state.eq.${state},home_state.eq.${state},away_state.eq.${state}`)
      .order('start_at')
      .order('id')
      .range(offset, offset + 999)
    if (error) {
      console.error('planner: query failed', error)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }
    rows.push(...((data ?? []) as SportsEventRow[]))
    if (!data || data.length < 1000) break
  }

  const { data: run } = await supabase
    .from('sports_refresh_runs')
    .select('ran_at, to_day')
    .order('ran_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const espn = rows.map(fromRow).filter((g): g is Game => g !== null)
  const curated = withoutSuperseded(curatedGames(from, to), espn)
  const body: PlannerResponse = {
    state,
    from,
    to,
    games: [...espn, ...curated].map(toWire),
    refreshedAt: run?.ran_at ?? null,
    horizon: run?.to_day ?? null,
  }
  return NextResponse.json(body, {
    // max-age keeps a browser from holding an old copy for days (it used to
    // apply its own heuristic and served a pre-refresh empty month); the CDN
    // keeps it 30 minutes.
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400' },
  })
}
