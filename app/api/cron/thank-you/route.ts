import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { isEmail, isHttpUrl, buildUpcomingOpenHousesHtml } from '@/lib/register-helpers'
import { createShortUrl } from '@/lib/short-urls'
import { buildThankYouEmail, thankYouSendState, type ThankYouSponsorCard } from '@/lib/thank-you-email'
import { resolveEmailBranding, listingFacts, loadUpcomingOpenHouses } from '@/lib/thank-you-data'

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
    .select('id, first_name, email, email_status, registered_at, open_house_id, agent_id, sponsor_id, feedback_token, feedback_submitted_at')
    .is('thank_you_sent_at', null)
    .gte('registered_at', floorIso)
    .not('email', 'is', null)
    // Visitors the agent added by hand never accepted the sign-in consent,
    // so ohACCESS doesn't email them (lib/manual-visitor.ts).
    .or('source.is.null,source.neq.manual')
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
      .select('id, full_name, email, display_email, phone, brokerage, brokerage_id, primary_color, accent_color, logo_url, headshot_url, license_number, state, landing_page_url')
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
      .select('id, full_name, company, display_email, phone, license_number, headshot_url, logo_url, landing_page_url')
      .in('id', sponsorIds)
    for (const s of data ?? []) sponsorMap.set(s.id, s)
  }

  // Tracked short links for the "Agent information" / "Sponsor information"
  // links (same kinds as the codeword email), one per open house + page per run.
  const shortLinks = new Map<string, Promise<string | null>>()
  const shortLink = (url: string | null | undefined, agentId: string, ohId: string, kind: 'agent' | 'sponsor') => {
    if (!isHttpUrl(url)) return Promise.resolve(null)
    const key = `${kind}|${ohId}|${url}`
    if (!shortLinks.has(key)) shortLinks.set(key, createShortUrl(url, agentId, ohId, kind))
    return shortLinks.get(key)!
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

    const brokerage = agent.brokerage_id ? brokerageMap.get(agent.brokerage_id) as Record<string, string | null> | undefined : undefined
    const { primary, accent, onPrimary, onAccent, logoUrl } = resolveEmailBranding(agent, brokerage)

    const street = oh.street_address || oh.property_address || 'the open house'
    const fullAddress = oh.property_address || street
    const dateLabel = fmtDate(v.registered_at, oh.timezone)

    const upcomingHtml = buildUpcomingOpenHousesHtml(await loadUpcomingOpenHouses(supabase, agent, oh, v.open_house_id), APP_URL, accent)

    let sponsor: ThankYouSponsorCard | null = null
    if (v.sponsor_id) {
      const s = sponsorMap.get(v.sponsor_id) as Record<string, string | null> | undefined
      if (s?.full_name) {
        sponsor = {
          name: s.full_name, company: s.company, email: s.display_email, phone: s.phone,
          licenseNumber: s.license_number, headshotUrl: s.headshot_url, logoUrl: s.logo_url,
          infoUrl: await shortLink(s.landing_page_url, v.agent_id, v.open_house_id, 'sponsor'),
        }
      }
    }

    const { subject, html } = buildThankYouEmail({
      appUrl: APP_URL,
      primary, accent, onPrimary, onAccent,
      visitorFirst: v.first_name || 'there',
      street, city: oh.city, fullAddress, dateLabel,
      agentName: agent.full_name || 'your agent',
      brokerage: agent.brokerage || null,
      headshotUrl: agent.headshot_url, agentLogoUrl: logoUrl,
      agentPhone: agent.phone,
      agentEmail: agent.display_email || agent.email || 'support@ohaccess.com',
      agentLicenseNumber: agent.license_number,
      agentLicenseState: agent.state,
      agentInfoUrl: await shortLink(agent.landing_page_url, v.agent_id, v.open_house_id, 'agent'),
      listingUrl: oh.listing_url,
      facts: listingFacts(oh),
      // The after-tour questions, for the visitors who never scrolled back to
      // them on the success screen. Dropped once they've answered (there or
      // via an earlier email).
      feedbackUrl: v.feedback_token && !v.feedback_submitted_at
        ? `${APP_URL}/feedback/${v.feedback_token}`
        : null,
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

export const GET = handle
export const POST = handle
