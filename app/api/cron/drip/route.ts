import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { isEmail } from '@/lib/register-helpers'
import { isExpiredPrepaidAccess } from '@/lib/billing-plans'
import { HARDWARE_OFFER_ACTIVE } from '@/lib/hardware-offer'
import { welcomeFirstName } from '@/lib/welcome-email'
import { decideDripEmail, type DripAgentState, type DripEmailKey } from '@/lib/drip'
import {
  buildFinishSetupEmail,
  buildFirstOpenHouseEmail,
  buildReferralEmail,
  buildHardwareOfferEmail,
  buildCheckinEmail,
} from '@/lib/drip-emails'
import { getOrCreateReferralCode, referralShortUrl } from '@/lib/referral-code'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

// Per-run send budget: keeps the first runs (whole existing base becomes
// eligible at once) drizzling out over days instead of blasting, and keeps
// the function comfortably inside its execution window.
const MAX_SENDS = 50
// Resend's default rate limit is 2 requests/second.
const SEND_SPACING_MS = 600

// Segments the daily run works through when the budget forces a choice:
// onboarding nudges first (time-sensitive — the ceiling on finish_setup and
// the cold-start window both close), retention last.
const KEY_PRIORITY: Record<DripEmailKey, number> = {
  finish_setup: 0,
  first_open_house: 1,
  referral: 2,
  hardware_offer: 3,
  checkin_1: 4,
  checkin_2: 4,
  checkin_3: 4,
}

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  tier: string | null
  sponsor_id: string | null
  billing_interval: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
  drip_opt_out_at: string | null
  drip_unsubscribe_token: string | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Reads a whole table in 1000-row pages (PostgREST's per-request ceiling).
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

// GET/POST: recurring job (Supabase pg_cron, daily — see
// docs/drip-emails-setup.md). Sends the lifecycle emails on the schedule in
// lib/drip.ts. Protected by a shared secret, mirroring the other
// app/api/cron/* routes. At-most-once per (agent, email): each send first
// claims a row in agent_email_log — the unique constraint is the lock — and
// a failed send releases its claim so tomorrow's run retries.
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // ── Gather account state (auth users are the source of truth for signup ──
  // time and last login; profiles carry tier/opt-out; the rest is aggregates).
  const authUsers = new Map<
    string,
    {
      email: string | null
      created_at: string
      last_sign_in_at: string | null
      user_metadata: Record<string, unknown>
    }
  >()
  for (let page = 1; ; page++) {
    const { data: list, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !list?.users?.length) break
    for (const u of list.users) {
      authUsers.set(u.id, {
        email: u.email || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at || null,
        user_metadata: u.user_metadata || {},
      })
    }
    if (list.users.length < 1000) break
  }

  let profiles: ProfileRow[]
  let openHouses: { agent_id: string; created_at: string | null; start_at: string | null }[]
  let log: { agent_id: string; email_key: string; sent_at: string }[]
  let optOutEmails: Set<string>
  let claimedProfileIds: Set<string>
  try {
    profiles = await pageAll<ProfileRow>((from, to) =>
      supabase
        .from('profiles')
        .select(
          'id, email, full_name, tier, sponsor_id, billing_interval, stripe_subscription_id, current_period_end, drip_opt_out_at, drip_unsubscribe_token'
        )
        .order('id')
        .range(from, to)
    )
    openHouses = await pageAll((from, to) =>
      supabase.from('open_houses').select('agent_id, created_at, start_at').order('id').range(from, to)
    )
    log = await pageAll((from, to) =>
      supabase.from('agent_email_log').select('agent_id, email_key, sent_at').order('id').range(from, to)
    )
    // The visitor suppression list doubles as a hard stop here: an address
    // that asked ohACCESS to go away gets nothing from us, in any role.
    optOutEmails = new Set(
      (
        await pageAll<{ email: string }>((from, to) =>
          supabase.from('email_opt_outs').select('email').order('email').range(from, to)
        )
      ).map((r) => r.email.toLowerCase())
    )
    claimedProfileIds = new Set(
      (
        await pageAll<{ profile_id: string | null }>((from, to) =>
          supabase.from('hardware_claims').select('profile_id').order('id').range(from, to)
        )
      )
        .map((r) => r.profile_id)
        .filter((id): id is string => !!id)
    )
  } catch (e) {
    console.error('drip: data load failed', e)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const profileById = new Map(profiles.map((p) => [p.id, p]))

  // Sponsor coverage (active sponsor = paid-level access, skip the upsell).
  const sponsorIds = [...new Set(profiles.map((p) => p.sponsor_id).filter(Boolean))] as string[]
  const activeSponsors = new Set<string>()
  for (let i = 0; i < sponsorIds.length; i += 200) {
    const { data } = await supabase
      .from('sponsors')
      .select('id, billing_status')
      .in('id', sponsorIds.slice(i, i + 200))
    for (const s of data ?? []) {
      if (s.billing_status === 'active') activeSponsors.add(s.id)
    }
  }

  const ohStats = new Map<string, { count: number; lastActivity: number; upcoming: boolean }>()
  const nowMs = now.getTime()
  for (const oh of openHouses) {
    if (!oh.agent_id) continue
    const stat = ohStats.get(oh.agent_id) ?? { count: 0, lastActivity: 0, upcoming: false }
    stat.count++
    for (const iso of [oh.created_at, oh.start_at]) {
      const ms = iso ? Date.parse(iso) : NaN
      if (!Number.isNaN(ms) && ms > stat.lastActivity) stat.lastActivity = ms
    }
    const startMs = oh.start_at ? Date.parse(oh.start_at) : NaN
    if (!Number.isNaN(startMs) && startMs >= nowMs) stat.upcoming = true
    ohStats.set(oh.agent_id, stat)
  }

  const sentByAgent = new Map<string, Partial<Record<DripEmailKey, string>>>()
  for (const row of log) {
    const sent = sentByAgent.get(row.agent_id) ?? {}
    sent[row.email_key as DripEmailKey] = row.sent_at
    sentByAgent.set(row.agent_id, sent)
  }

  // ── Decide ────────────────────────────────────────────────────────────────
  const candidates: { userId: string; key: DripEmailKey; createdAt: string }[] = []
  for (const [userId, u] of authUsers) {
    const profile = profileById.get(userId)
    const email = (profile?.email || u.email || '').trim()
    const oh = ohStats.get(userId)
    const paidTier =
      !!profile &&
      ['pro', 'team', 'brokerage'].includes(profile.tier || 'free') &&
      !isExpiredPrepaidAccess(profile)
    const sponsorCovered = !!profile?.sponsor_id && activeSponsors.has(profile.sponsor_id)

    const state: DripAgentState = {
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at,
      optedOut: !!profile?.drip_opt_out_at || optOutEmails.has(email.toLowerCase()),
      hasEmail: isEmail(email),
      paidAccess: paidTier || sponsorCovered,
      hardwareOfferActive: HARDWARE_OFFER_ACTIVE,
      hasHardwareClaim: claimedProfileIds.has(userId),
      openHouseCount: oh?.count ?? 0,
      lastOpenHouseActivityAt: oh?.lastActivity ? new Date(oh.lastActivity).toISOString() : null,
      hasUpcomingOpenHouse: oh?.upcoming ?? false,
      sent: sentByAgent.get(userId) ?? {},
    }

    const key = decideDripEmail(state, now)
    if (key) candidates.push({ userId, key, createdAt: u.created_at })
  }

  candidates.sort(
    (a, b) =>
      KEY_PRIORITY[a.key] - KEY_PRIORITY[b.key] || b.createdAt.localeCompare(a.createdAt)
  )

  // ── Send ──────────────────────────────────────────────────────────────────
  let sent = 0
  let failed = 0
  for (const c of candidates) {
    if (sent >= MAX_SENDS) break
    const u = authUsers.get(c.userId)!

    // finish_setup targets may predate their profile row (it's normally
    // created at email confirmation). Mirror the new-account route's
    // auto-create so the send gets an unsubscribe token to carry.
    let profile = profileById.get(c.userId)
    if (!profile) {
      await supabase
        .from('profiles')
        .upsert({ id: c.userId, email: u.email }, { onConflict: 'id', ignoreDuplicates: true })
      const { data } = await supabase
        .from('profiles')
        .select(
          'id, email, full_name, tier, sponsor_id, billing_interval, stripe_subscription_id, current_period_end, drip_opt_out_at, drip_unsubscribe_token'
        )
        .eq('id', c.userId)
        .maybeSingle()
      if (!data) continue
      profile = data as ProfileRow
      profileById.set(c.userId, profile)
    }
    if (!profile.drip_unsubscribe_token || profile.drip_opt_out_at) continue
    const to = (profile.email || u.email || '').trim()
    if (!isEmail(to)) continue

    // Claim before sending — the unique constraint makes this at-most-once
    // even if two runs overlap.
    const { error: claimError } = await supabase
      .from('agent_email_log')
      .insert({ agent_id: c.userId, email_key: c.key })
    if (claimError) {
      if (claimError.code !== '23505') console.error('drip: claim failed', c, claimError)
      continue
    }
    const releaseClaim = () =>
      supabase.from('agent_email_log').delete().eq('agent_id', c.userId).eq('email_key', c.key)

    const firstName = welcomeFirstName(profile.full_name, u.user_metadata)
    const unsubscribeUrl = `${APP_URL}/unsubscribe?agent=${profile.drip_unsubscribe_token}`
    const opts = { firstName, appUrl: APP_URL, unsubscribeUrl }

    let built: { subject: string; html: string } | null = null
    if (c.key === 'finish_setup') built = buildFinishSetupEmail(opts)
    else if (c.key === 'first_open_house') built = buildFirstOpenHouseEmail(opts)
    else if (c.key === 'hardware_offer') built = buildHardwareOfferEmail(opts)
    else if (c.key === 'referral') {
      const code = await getOrCreateReferralCode(supabase, c.userId)
      if (!code) {
        await releaseClaim()
        continue
      }
      built = buildReferralEmail({ ...opts, referralUrl: referralShortUrl(code) })
    } else built = buildCheckinEmail(opts)

    try {
      await resend.emails.send({
        from: 'ohACCESS <hello@mail.ohaccess.com>',
        to,
        replyTo: 'support@ohaccess.com',
        subject: built.subject,
        html: built.html,
        headers: {
          'List-Unsubscribe': `<${APP_URL}/api/unsubscribe?agent=${profile.drip_unsubscribe_token}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })
      sent++
    } catch (e) {
      console.error('drip: send failed', { userId: c.userId, key: c.key, e })
      await releaseClaim()
      failed++
    }
    await sleep(SEND_SPACING_MS)
  }

  return NextResponse.json({ ok: true, eligible: candidates.length, sent, failed })
}

export const GET = handle
export const POST = handle
