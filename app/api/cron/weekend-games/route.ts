import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { isEmail } from '@/lib/register-helpers'
import { notifyAdmins } from '@/lib/notify-admin'
import { escapeHtml } from '@/lib/escape-html'
import { welcomeFirstName } from '@/lib/welcome-email'
import {
  agentTimeZone,
  sendDue,
  weekendGamesEmailKey,
  weekendGamesState,
} from '@/lib/weekend-games/audience'
import { fetchWeekendGames, type Game } from '@/lib/weekend-games/espn'
import { buildWeekendPlan } from '@/lib/weekend-games/plan'
import { buildWeekendGamesEmail } from '@/lib/weekend-games/email'
import { addDays } from '@/lib/weekend-games/time'
import { isLatLng, type LatLng } from '@/lib/weekend-games/sun'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

// Per-run send budget; anyone left over is picked up by the next hourly run
// (the send window is 8 to 10 AM local).
const MAX_SENDS = 150
// Resend's default rate limit is 2 requests/second.
const SEND_SPACING_MS = 600

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  brokerage: string | null
  phone: string | null
  license_number: string | null
  state: string | null
  country: string | null
  drip_opt_out_at: string | null
  drip_unsubscribe_token: string | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Reads a whole table in 1000-row pages (PostgREST's per-request ceiling).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pageAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...(data as T[]))
    if (data.length < 1000) break
  }
  return rows
}

// GET/POST: recurring job (Supabase pg_cron, hourly on Wednesdays, see
// docs/weekend-games-setup.md). Sends "Planning on an Open House this
// weekend?" with the agent's state's games, at 8 AM in the agent's own time
// zone. Protected by the shared cron secret. At-most-once per (agent,
// weekend) via an agent_email_log claim; a failed send releases its claim so
// the next hourly run retries. If a required league's schedule can't be
// read, nobody gets a half-empty email: the run stops and the team gets an
// alert. ?catchup=true (called by hand after a missed Wednesday, see the
// setup doc) sends to everyone who hasn't had this weekend's email yet,
// whatever the local time, Wednesday through Friday.
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const catchup = new URL(request.url).searchParams.get('catchup') === 'true'

  let profiles: ProfileRow[]
  let sentKeys: Set<string>
  let optOutEmails: Set<string>
  try {
    profiles = await pageAll<ProfileRow>((from, to) =>
      supabase
        .from('profiles')
        .select(
          'id, email, full_name, brokerage, phone, license_number, state, country, drip_opt_out_at, drip_unsubscribe_token'
        )
        .order('id')
        .range(from, to)
    )
    sentKeys = new Set(
      (
        await pageAll<{ agent_id: string; email_key: string }>((from, to) =>
          supabase
            .from('agent_email_log')
            .select('agent_id, email_key')
            .like('email_key', 'weekend_games_%')
            .order('id')
            .range(from, to)
        )
      ).map((r) => `${r.agent_id}|${r.email_key}`)
    )
    optOutEmails = new Set(
      (
        await pageAll<{ email: string }>((from, to) =>
          supabase.from('email_opt_outs').select('email').order('email').range(from, to)
        )
      ).map((r) => r.email.toLowerCase())
    )
  } catch (e) {
    console.error('weekend-games: data load failed', e)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  // ── Who's due this hour ───────────────────────────────────────────────────
  const due: { profile: ProfileRow; to: string; state: string; timeZone: string; saturdayYmd: string; key: string }[] = []
  for (const profile of profiles) {
    const state = weekendGamesState(profile)
    if (!state) continue
    const to = (profile.email || '').trim()
    if (!isEmail(to) || profile.drip_opt_out_at || !profile.drip_unsubscribe_token) continue
    if (optOutEmails.has(to.toLowerCase())) continue
    const timeZone = agentTimeZone(state)
    const when = sendDue(now, timeZone, { catchup })
    if (!when) continue
    const key = weekendGamesEmailKey(when.saturdayYmd)
    if (sentKeys.has(`${profile.id}|${key}`)) continue
    due.push({ profile, to, state, timeZone, saturdayYmd: when.saturdayYmd, key })
  }
  if (!due.length) return NextResponse.json({ ok: true, catchup, due: 0, sent: 0, failed: 0 })

  // ── This weekend's games (normally one weekend per run) ──────────────────
  const gamesByWeekend = new Map<string, Game[]>()
  const skippedLeagues = new Set<string>()
  try {
    for (const saturdayYmd of new Set(due.map((d) => d.saturdayYmd))) {
      const { games, skippedLeagues: skipped } = await fetchWeekendGames(saturdayYmd, addDays(saturdayYmd, 1))
      // Every weekend of the year has pro games somewhere in the country, so
      // an empty feed means ESPN changed something, not a quiet weekend.
      if (!games.length) throw new Error('ESPN returned no games in any league')
      gamesByWeekend.set(saturdayYmd, games)
      for (const key of skipped) skippedLeagues.add(key)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('weekend-games: schedule fetch failed', message)
    await notifyAdmins(
      'Weekend games email: sports schedule unavailable',
      `<p>The Wednesday "Planning on an Open House this weekend?" email couldn't read the game schedule from ESPN, so nothing was sent this run (${due.length} agents waiting). It tries again next hour, until 10 AM in each agent's time zone.</p><p style="color:#6e6e73;font-size:13px;">${escapeHtml(message)}</p>`
    )
    return NextResponse.json({ error: 'Schedule unavailable', due: due.length }, { status: 502 })
  }
  // Sunrise/sunset location: each agent's most recent open house with map
  // coordinates (the map geocodes them on first load; rows created before
  // migration 037 or never mapped have none). Missing = state metro fallback.
  const locationByAgent = new Map<string, LatLng>()
  try {
    const dueIds = due.map((d) => d.profile.id)
    for (let i = 0; i < dueIds.length; i += 200) {
      const { data, error } = await supabase
        .from('open_houses')
        .select('agent_id, lat, lng, start_at')
        .in('agent_id', dueIds.slice(i, i + 200))
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('start_at', { ascending: false })
      if (error) throw error
      for (const row of data ?? []) {
        if (!locationByAgent.has(row.agent_id) && isLatLng(row)) {
          locationByAgent.set(row.agent_id, { lat: row.lat, lng: row.lng })
        }
      }
    }
  } catch (e) {
    // Best-effort: the metro fallback is fine for everyone.
    console.error('weekend-games: open-house coordinates unavailable', e)
  }

  if (skippedLeagues.size) {
    const list = [...skippedLeagues].join(', ')
    console.error('weekend-games: sending without optional leagues', list)
    await notifyAdmins(
      'Weekend games email: sent without some leagues',
      `<p>ESPN couldn't serve these leagues this run, so the "Planning on an Open House this weekend?" email went out without them (${due.length} agents): ${escapeHtml(list)}. Everything else was included. Nothing to do unless it keeps happening.</p>`
    )
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  let sent = 0
  let failed = 0
  for (const d of due) {
    if (sent >= MAX_SENDS) break

    // Claim before sending: the unique constraint makes this at-most-once
    // even if two runs overlap.
    const { error: claimError } = await supabase
      .from('agent_email_log')
      .insert({ agent_id: d.profile.id, email_key: d.key })
    if (claimError) {
      if (claimError.code !== '23505') console.error('weekend-games: claim failed', d.profile.id, claimError)
      continue
    }
    const releaseClaim = () =>
      supabase.from('agent_email_log').delete().eq('agent_id', d.profile.id).eq('email_key', d.key)

    const plan = buildWeekendPlan({
      games: gamesByWeekend.get(d.saturdayYmd) ?? [],
      state: d.state,
      timeZone: d.timeZone,
      saturdayYmd: d.saturdayYmd,
      location: locationByAgent.get(d.profile.id) ?? null,
    })
    const built = buildWeekendGamesEmail({
      firstName: welcomeFirstName(d.profile.full_name, null),
      plan,
      appUrl: APP_URL,
      unsubscribeUrl: `${APP_URL}/unsubscribe?agent=${d.profile.drip_unsubscribe_token}&from=weekend_games`,
    })

    try {
      const { error } = await resend.emails.send({
        from: 'ohACCESS <hello@mail.ohaccess.com>',
        to: d.to,
        replyTo: 'support@ohaccess.com',
        subject: built.subject,
        html: built.html,
        headers: {
          'List-Unsubscribe': `<${APP_URL}/api/unsubscribe?agent=${d.profile.drip_unsubscribe_token}&from=weekend_games>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })
      if (error) throw new Error(error.message)
      sent++
    } catch (e) {
      console.error('weekend-games: send failed', { agentId: d.profile.id, e })
      await releaseClaim()
      failed++
    }
    await sleep(SEND_SPACING_MS)
  }

  return NextResponse.json({ ok: true, catchup, due: due.length, sent, failed, skippedLeagues: [...skippedLeagues] })
}

export const GET = handle
export const POST = handle
