import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { notifyAdmins } from '@/lib/notify-admin'
import { escapeHtml } from '@/lib/escape-html'
import { fetchLeagueRange } from '@/lib/weekend-games/espn'
import { LEAGUES } from '@/lib/weekend-games/leagues'
import { addDays, zonedParts } from '@/lib/weekend-games/time'
import { toRow } from '@/lib/planner/rows'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// How far ahead the planner's schedule reaches. ESPN publishes most
// leagues' seasons in full, so this is a request-budget choice, not a data
// limit: 150 days is about 550 ESPN calls a run.
const DEFAULT_DAYS = 150
const MAX_DAYS = 366
// Stop starting new leagues after this long so the run finishes inside
// Vercel's limit; whatever was skipped is named in the response and the
// alert, and next week's run picks it up.
const TIME_BUDGET_MS = 240_000
const UPSERT_CHUNK = 500

// GET/POST: recurring job (Supabase pg_cron, weekly, see
// docs/planner-setup.md). Re-reads every league's schedule from ESPN for
// the next DEFAULT_DAYS days into sports_events, then deletes rows in that
// window the feed no longer lists (a rescheduled or removed game). A league
// ESPN can't serve keeps last run's rows and is named in failedLeagues; a
// required league failing, or the run timing out, alerts support@.
// Protected by the shared cron secret. ?days=N and ?from=YYYY-MM-DD narrow
// or widen the window; ?leagues=football/nfl,golf/pga limits the run.
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const runStartIso = new Date(startedAt).toISOString()
  const params = new URL(request.url).searchParams
  const days = Math.min(MAX_DAYS, Math.max(1, Number(params.get('days')) || DEFAULT_DAYS))
  const todayEt = zonedParts(new Date(), 'America/New_York').ymd
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.get('from') ?? '') ? params.get('from')! : todayEt
  const to = addDays(from, days - 1)
  const only = (params.get('leagues') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const leagues = only.length ? LEAGUES.filter((l) => only.includes(l.key)) : LEAGUES

  const counts: Record<string, number> = {}
  const failed: string[] = []
  const errors: Record<string, string> = {}
  const skipped: string[] = []
  let total = 0

  for (const league of leagues) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      skipped.push(league.key)
      continue
    }
    try {
      const games = await fetchLeagueRange(league, from, to, fetch, { nearDays: 14 })
      const rows = games.map((g) => toRow(g, runStartIso)).filter((r) => r.day_et >= from && r.day_et <= to)
      for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
        const { error } = await supabase.from('sports_events').upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: 'id' })
        if (error) throw new Error(`upsert failed: ${error.message}`)
      }
      // Anything in the window this run didn't see is gone from ESPN.
      const { error: pruneError } = await supabase
        .from('sports_events')
        .delete()
        .eq('league_key', league.key)
        .eq('source', 'espn')
        .gte('day_et', from)
        .lte('day_et', to)
        .lt('updated_at', runStartIso)
      if (pruneError) throw new Error(`prune failed: ${pruneError.message}`)
      counts[league.key] = rows.length
      total += rows.length
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('sports-refresh: league failed', league.key, message)
      failed.push(league.key)
      errors[league.key] = message
    }
  }

  const ms = Date.now() - startedAt
  const timedOut = skipped.length > 0
  const { error: logError } = await supabase.from('sports_refresh_runs').insert({
    from_day: from,
    to_day: to,
    games: total,
    failed_leagues: [...failed, ...skipped],
    timed_out: timedOut,
    ms,
  })
  if (logError) console.error('sports-refresh: could not log run', logError)

  const requiredFailed = failed.filter((key) => !LEAGUES.find((l) => l.key === key)?.optional)
  if (requiredFailed.length || timedOut) {
    const lines = [
      requiredFailed.length
        ? `<p>ESPN couldn't be read for: <strong>${escapeHtml(requiredFailed.join(', '))}</strong>. The planner keeps showing last week's schedule for those leagues until the next weekly run succeeds.</p>`
        : '',
      failed.filter((k) => !requiredFailed.includes(k)).length
        ? `<p>Optional leagues also skipped this run: ${escapeHtml(failed.filter((k) => !requiredFailed.includes(k)).join(', '))}.</p>`
        : '',
      timedOut
        ? `<p>The run hit its time budget before reaching: ${escapeHtml(skipped.join(', '))}. They'll be refreshed next week, or run the job by hand with <code>?leagues=</code> (see docs/planner-setup.md).</p>`
        : '',
      `<p style="color:#6e6e73;font-size:13px;">${escapeHtml(Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join(' | '))}</p>`,
    ]
    await notifyAdmins('Planner schedule refresh: problems this week', lines.join(''))
  }

  return NextResponse.json({ ok: !requiredFailed.length && !timedOut, from, to, games: total, counts, failedLeagues: failed, skippedLeagues: skipped, ms })
}

export const GET = handle
export const POST = handle
