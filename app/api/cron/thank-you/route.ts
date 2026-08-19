import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { isHexColor, safeUrl, isEmail, buildUpcomingOpenHousesHtml, type UpcomingOpenHouse } from '@/lib/register-helpers'
import { onColor } from '@/lib/colors'
import { formatArea } from '@/lib/regions'
import { buildThankYouEmail, thankYouSendState, type ThankYouSponsorCard } from '@/lib/thank-you-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

// Only look at recent sign-ins so we never scan (or accidentally blast) the
// historical visitor base — the next-morning window lives inside this floor.
const LOOKBACK_MS = 3 * 24 * 60 * 60_000

// Delivery statuses that mean the address is bad — skip the thank-you.
const BAD_EMAIL = new Set(['bounced', 'complained', 'failed'])

// GET/POST: recurring job (Supabase pg_cron, hourly). Sends the post-event
// "thanks for visiting" email the morning after each visit (9am+ in the
// property's timezone), once per visitor. Idempotent via thank_you_sent_at.
// Protected by a shared secret. Mirrors the other app/api/cron/* routes.
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const floorIso = new Date(now.getTime() - LOOKBACK_MS).toISOString()

  const { data: visitors, error } = await supabase
    .from('visitors')
    .select('id, first_name, email, email_status, registered_at, open_house_id, agent_id, sponsor_id')
    .is('thank_you_sent_at', null)
    .gte('registered_at', floorIso)
    .not('email', 'is', null)
    .limit(300)

  if (error) {
    console.error('thank-you query failed', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  // Batch-load the open houses, agents, brokerages and sponsors these visitors
  // reference, so the per-visitor loop does no extra round-trips.
  const ohIds = [...new Set((visitors ?? []).map(v => v.open_house_id).filter(Boolean))]
  const agentIds = [...new Set((visitors ?? []).map(v => v.agent_id).filter(Boolean))]
  const sponsorIds = [...new Set((visitors ?? []).map(v => v.sponsor_id).filter(Boolean))]

  const ohMap = new Map<string, Record<string, unknown>>()
  const agentMap = new Map<string, Record<string, unknown>>()
  const brokerageMap = new Map<string, Record<string, unknown>>()
  const sponsorMap = new Map<string, Record<string, unknown>>()

  if (ohIds.length) {
    const { data } = await supabase.from('open_houses')
      .select('id, agent_id, street_address, property_address, city, state, timezone, listing_url, listing_price, bedrooms, bathrooms, square_footage, country')
      .in('id', ohIds)
    for (const oh of data ?? []) ohMap.set(oh.id, oh)
  }
  if (agentIds.length) {
    const { data } = await supabase.from('profiles')
      .select('id, full_name, email, display_email, phone, brokerage, brokerage_id, primary_color, accent_color, logo_url, headshot_url')
      .in('id', agentIds)
    for (const a of data ?? []) agentMap.set(a.id, a)
  }
  const brokerageIds = [...new Set([...agentMap.values()].map(a => a.brokerage_id).filter(Boolean) as string[])]
  if (brokerageIds.length) {
    const { data } = await supabase.from('brokerages')
      .select('id, name, primary_color, accent_color, logo_url')
      .in('id', brokerageIds)
    for (const b of data ?? []) brokerageMap.set(b.id, b)
  }
  if (sponsorIds.length) {
    const { data } = await supabase.from('sponsors')
      .select('id, full_name, company, display_email, phone, logo_url')
      .in('id', sponsorIds)
    for (const s of data ?? []) sponsorMap.set(s.id, s)
  }

  let processed = 0
  for (const v of visitors ?? []) {
    const to = (v.email || '').trim()
    if (!isEmail(to) || BAD_EMAIL.has((v.email_status || '').toLowerCase())) continue

    const oh = ohMap.get(v.open_house_id) as Record<string, string | null> | undefined
    const agent = agentMap.get(v.agent_id) as Record<string, string | null> | undefined
    if (!oh || !agent) continue

    // Next-morning timing, anchored to the visitor's local visit date.
    if (thankYouSendState(v.registered_at, oh.timezone, now) !== 'send') continue

    // Brokerage-over-agent branding, matching every other email (team settings
    // mirror colors onto member profiles; brokerage row is the extra guard).
    const brokerage = agent.brokerage_id ? brokerageMap.get(agent.brokerage_id) as Record<string, string | null> | undefined : undefined
    const primaryRaw = brokerage?.primary_color || agent.primary_color
    const accentRaw = agent.accent_color || brokerage?.accent_color
    const primary = primaryRaw && isHexColor(primaryRaw) ? primaryRaw : '#1d1d1f'
    const accent = accentRaw && isHexColor(accentRaw) ? accentRaw : '#0071e3'
    const logoUrl = safeUrl(brokerage?.logo_url || agent.logo_url) || null

    const street = oh.street_address || oh.property_address || 'the open house'
    const fullAddress = oh.property_address || street
    const dateLabel = fmtDate(v.registered_at, oh.timezone)

    const facts = [
      oh.listing_price ? String(oh.listing_price) : '',
      oh.bedrooms ? `${oh.bedrooms} bd` : '',
      oh.bathrooms ? `${oh.bathrooms} ba` : '',
      formatArea(oh.square_footage, oh.country),
    ].filter(Boolean).join(' · ')

    const upcomingHtml = await buildUpcoming(agent, oh, v.open_house_id)

    let sponsor: ThankYouSponsorCard | null = null
    if (v.sponsor_id) {
      const s = sponsorMap.get(v.sponsor_id) as Record<string, string | null> | undefined
      if (s?.full_name) {
        sponsor = { name: s.full_name, company: s.company, email: s.display_email, phone: s.phone, logoUrl: s.logo_url }
      }
    }

    const { subject, html } = buildThankYouEmail({
      appUrl: APP_URL,
      primary, accent, onPrimary: onColor(primary), onAccent: onColor(accent),
      visitorFirst: v.first_name || 'there',
      street, city: oh.city, fullAddress, dateLabel,
      agentName: agent.full_name || 'your agent',
      brokerage: agent.brokerage || null,
      headshotUrl: agent.headshot_url, agentLogoUrl: logoUrl,
      agentPhone: agent.phone,
      agentEmail: agent.display_email || agent.email || 'support@ohaccess.com',
      listingUrl: oh.listing_url,
      facts: facts || null,
      upcomingHtml,
      sponsor,
    })

    try {
      await resend.emails.send({
        from: 'ohACCESS <hello@mail.ohaccess.com>',
        to,
        // Replies go to the hosting agent — the email speaks in their voice.
        replyTo: agent.display_email || agent.email || 'support@ohaccess.com',
        subject,
        html,
      })
      await supabase.from('visitors').update({ thank_you_sent_at: new Date().toISOString() }).eq('id', v.id)
      processed++
    } catch (err) {
      console.error('Failed to send thank-you', { id: v.id, err })
      // Leave thank_you_sent_at null so the next hourly run retries (still
      // inside the morning-after window).
    }
  }

  return NextResponse.json({ ok: true, processed })
}

function fmtDate(iso: string, tz: string | null): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      ...(tz ? { timeZone: tz } : {}),
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch {
    return new Date(iso).toLocaleDateString('en-US')
  }
}

// The agent's (and their team's) upcoming open houses in the same state, next
// 10 days, soonest first — same scope/query as the visitor code email. Best
// effort: a lookup failure just drops the section.
async function buildUpcoming(
  agent: Record<string, string | null>,
  oh: Record<string, string | null>,
  currentOhId: string
): Promise<string> {
  try {
    let agentIds: string[] = [agent.id as string]
    if (agent.brokerage_id) {
      const { data: teammates } = await supabase.from('profiles').select('id').eq('brokerage_id', agent.brokerage_id)
      if (teammates && teammates.length) {
        agentIds = teammates.map(t => t.id)
        if (!agentIds.includes(agent.id as string)) agentIds.push(agent.id as string)
      }
    }
    const nowIso = new Date().toISOString()
    const horizonIso = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    let query = supabase.from('open_houses')
      .select('id, property_address, city, open_house_date, open_house_hours, listing_price, bedrooms, bathrooms, start_at, end_at')
      .in('agent_id', agentIds)
      .neq('id', currentOhId)
      .gte('start_at', nowIso)
      .lte('start_at', horizonIso)
      .order('start_at', { ascending: true })
      .order('city', { ascending: true })
      .limit(5)
    const state = (oh.state || '').trim().replace(/[%_]/g, '')
    if (state) query = query.ilike('state', state)
    const { data } = await query
    return buildUpcomingOpenHousesHtml((data ?? []) as UpcomingOpenHouse[], APP_URL)
  } catch {
    return ''
  }
}

export const GET = handle
export const POST = handle
