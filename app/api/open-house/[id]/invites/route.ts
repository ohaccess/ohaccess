import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { isHexColor, safeUrl, isEmail } from '@/lib/register-helpers'
import { onColor } from '@/lib/colors'
import {
  computeInviteAudience,
  buildInviteEmail,
  normalizeEmail,
  INVITE_FREQUENCY_WINDOW_DAYS,
  INVITE_BATCH_MAX,
  type InviteMatch,
} from '@/lib/invite-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

// "Re-invite past visitors" for one upcoming open house.
//   GET  → preview: who would receive an invite, and who's excluded and why.
//   POST → send: recomputes eligibility server-side (never trusts a client
//          list), then emails each match and records the send.
// Owner-only; the consent basis is the visitor↔host-agent clickwrap, so the
// audience is always the authenticated agent's own past visitors.

type OhRow = {
  id: string; agent_id: string; property_address: string | null
  street_address: string | null; city: string | null; state: string | null
  open_house_date: string | null; open_house_hours: string | null
  start_at: string | null; end_at: string | null; timezone: string | null
  listing_price: string | null; bedrooms: string | null; bathrooms: string | null
  listing_url: string | null
}

// An invite only makes sense for an open house that hasn't ended.
function hasEnded(oh: OhRow): boolean {
  if (oh.end_at) return Date.now() > new Date(oh.end_at).getTime()
  if (oh.open_house_date) {
    const t = Date.parse(oh.open_house_date)
    if (!Number.isNaN(t)) {
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
      return t < startOfToday.getTime()
    }
  }
  return false
}

// Shared by GET and POST: load the open house (owner-checked) and compute
// the audience. Returns an error response to pass through, or the data.
async function buildAudience(request: Request, id: string) {
  const user = await getAuthenticatedUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: oh } = await supabase
    .from('open_houses')
    .select('id, agent_id, property_address, street_address, city, state, open_house_date, open_house_hours, start_at, end_at, timezone, listing_price, bedrooms, bathrooms, listing_url')
    .eq('id', id)
    .maybeSingle()
  // 404 for missing AND not-owned — don't confirm existence to non-owners.
  if (!oh || oh.agent_id !== user.id) {
    return { error: NextResponse.json({ error: 'Open house not found' }, { status: 404 }) }
  }

  // The agent's past visitors (any of their open houses except this one).
  // Newest first + a generous cap: even very active agents stay well under
  // this within any realistic invite window.
  const { data: visitors, error: vErr } = await supabase
    .from('visitors')
    .select('first_name, last_name, email, email_status, sms_opted_out, purchasing_timeline, registered_at, open_house_id')
    .eq('agent_id', user.id)
    .not('email', 'is', null)
    .order('registered_at', { ascending: false })
    .limit(2000)
  if (vErr) {
    console.error('invite audience query failed', vErr)
    return { error: NextResponse.json({ error: 'Could not load your past visitors' }, { status: 500 }) }
  }

  // Prior invites: for this open house (never twice) and for the rolling
  // frequency window (cap per visitor per month).
  const windowStart = new Date(Date.now() - INVITE_FREQUENCY_WINDOW_DAYS * 24 * 60 * 60_000).toISOString()
  const [{ data: ohInvites }, { data: recentInvites }] = await Promise.all([
    supabase.from('visitor_invites').select('email').eq('open_house_id', id),
    supabase.from('visitor_invites').select('email').eq('agent_id', user.id).gte('sent_at', windowStart),
  ])

  // Global email unsubscribe list, narrowed to just these addresses.
  const candidateEmails = [...new Set((visitors ?? []).map(v => normalizeEmail(v.email)).filter(Boolean))]
  const optedOutEmails = new Set<string>()
  if (candidateEmails.length) {
    const { data: optOuts } = await supabase.from('email_opt_outs').select('email').in('email', candidateEmails)
    for (const row of optOuts ?? []) optedOutEmails.add(row.email)
  }

  const { matches, excluded } = computeInviteAudience({
    visitors: visitors ?? [],
    targetOpenHouseId: id,
    optedOutEmails,
    alreadyInvitedEmails: new Set((ohInvites ?? []).map(r => r.email)),
    recentInviteEmails: (recentInvites ?? []).map(r => r.email),
    now: new Date(),
  })

  return { user, oh: oh as OhRow, matches, excluded }
}

// Batch-load the addresses of the open houses the matched visitors last
// visited — for the preview list and the email's personal opener.
async function loadPastAddresses(matches: InviteMatch[]): Promise<Map<string, { property_address: string | null; street_address: string | null }>> {
  const ids = [...new Set(matches.map(m => m.lastVisitOpenHouseId).filter(Boolean))] as string[]
  const map = new Map<string, { property_address: string | null; street_address: string | null }>()
  if (!ids.length) return map
  const { data } = await supabase.from('open_houses').select('id, property_address, street_address').in('id', ids)
  for (const row of data ?? []) map.set(row.id, { property_address: row.property_address, street_address: row.street_address })
  return map
}

function fmtDateLabel(oh: OhRow): string {
  if (oh.start_at) {
    try {
      return new Date(oh.start_at).toLocaleDateString('en-US', {
        ...(oh.timezone ? { timeZone: oh.timezone } : {}),
        weekday: 'short', month: 'short', day: 'numeric',
      })
    } catch { /* fall through to the stored label */ }
  }
  return oh.open_house_date || ''
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const built = await buildAudience(request, id)
    if ('error' in built) return built.error
    const { oh, matches, excluded } = built

    const pastAddresses = await loadPastAddresses(matches)
    return NextResponse.json({
      canSend: !hasEnded(oh) && matches.length > 0,
      ended: hasEnded(oh),
      matches: matches.slice(0, INVITE_BATCH_MAX).map(m => ({
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        timeline: m.timeline,
        lastVisitAt: m.lastVisitAt,
        lastVisitAddress: m.lastVisitOpenHouseId
          ? (pastAddresses.get(m.lastVisitOpenHouseId)?.property_address ?? null)
          : null,
      })),
      truncated: Math.max(0, matches.length - INVITE_BATCH_MAX),
      excluded,
    })
  } catch (error) {
    console.error('Invite preview error:', error)
    return NextResponse.json({ error: 'Failed to load invite preview' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Batch-level limit: sends inside one call are the real volume control
    // (frequency cap + never-twice), this just stops hammering the endpoint.
    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'send-invites', 10, 3600)
    if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const built = await buildAudience(request, id)
    if ('error' in built) return built.error
    const { user, oh, matches, excluded } = built

    if (hasEnded(oh)) {
      return NextResponse.json({ error: 'This open house has already ended.' }, { status: 400 })
    }
    if (!matches.length) {
      return NextResponse.json({ sent: 0, failed: 0, excluded })
    }

    // Agent identity + brokerage-over-agent branding, matching every other
    // visitor-facing email.
    const { data: agent } = await supabase
      .from('profiles')
      .select('id, full_name, email, display_email, phone, brokerage, brokerage_id, primary_color, accent_color, logo_url, headshot_url')
      .eq('id', user.id)
      .maybeSingle()
    let brokerageRow: { primary_color: string | null; accent_color: string | null } | null = null
    if (agent?.brokerage_id) {
      const { data } = await supabase.from('brokerages').select('primary_color, accent_color').eq('id', agent.brokerage_id).maybeSingle()
      brokerageRow = data
    }
    const primaryRaw = brokerageRow?.primary_color || agent?.primary_color
    const accentRaw = agent?.accent_color || brokerageRow?.accent_color
    const primary = primaryRaw && isHexColor(primaryRaw) ? primaryRaw : '#1d1d1f'
    const accent = accentRaw && isHexColor(accentRaw) ? accentRaw : '#0071e3'
    const agentName = agent?.full_name || 'your agent'
    const agentEmail = agent?.display_email || agent?.email || 'support@ohaccess.com'

    const street = oh.street_address || oh.property_address || 'the property'
    const fullAddress = oh.property_address || street
    const dateLabel = fmtDateLabel(oh)
    const facts = [
      oh.listing_price ? String(oh.listing_price) : '',
      oh.bedrooms ? `${oh.bedrooms} bd` : '',
      oh.bathrooms ? `${oh.bathrooms} ba` : '',
    ].filter(Boolean).join(' · ')

    const pastAddresses = await loadPastAddresses(matches)

    let sent = 0
    let failed = 0
    for (const m of matches.slice(0, INVITE_BATCH_MAX)) {
      if (!isEmail(m.email)) continue

      // Reserve first: the (open_house_id, email) unique index makes this the
      // double-send guard — a concurrent POST loses the insert and skips.
      const token = randomUUID()
      const { data: reserved, error: reserveErr } = await supabase
        .from('visitor_invites')
        .insert({ open_house_id: oh.id, agent_id: user.id, email: m.email, unsubscribe_token: token })
        .select('id')
        .maybeSingle()
      if (reserveErr || !reserved) continue

      const past = m.lastVisitOpenHouseId ? pastAddresses.get(m.lastVisitOpenHouseId) : undefined
      const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${token}`
      const { subject, html } = buildInviteEmail({
        appUrl: APP_URL,
        primary, accent, onPrimary: onColor(primary), onAccent: onColor(accent),
        visitorFirst: m.firstName || 'there',
        pastStreet: past?.street_address || past?.property_address || null,
        agentName,
        brokerage: agent?.brokerage || null,
        headshotUrl: agent?.headshot_url || null,
        agentPhone: agent?.phone || null,
        agentEmail,
        oh: {
          id: oh.id, fullAddress, street, dateLabel,
          hoursLabel: oh.open_house_hours, startAt: oh.start_at, endAt: oh.end_at,
          facts: facts || null, listingUrl: oh.listing_url,
        },
        unsubscribeUrl,
      })

      try {
        const result = await resend.emails.send({
          from: 'ohACCESS <hello@mail.ohaccess.com>',
          to: m.email,
          // The email speaks in the agent's voice — replies go to them.
          replyTo: agentEmail,
          subject,
          html,
          // RFC 8058 one-click unsubscribe: mail clients POST straight to the
          // API (the visible link goes to the friendly /unsubscribe page).
          headers: {
            'List-Unsubscribe': `<${APP_URL}/api/unsubscribe?token=${token}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        })
        await supabase.from('visitor_invites')
          .update({ email_message_id: result.data?.id ?? null })
          .eq('id', reserved.id)
        sent++
      } catch (err) {
        console.error('Invite send failed', { openHouseId: oh.id, err })
        // Release the reservation so a later attempt can retry this address.
        await supabase.from('visitor_invites').delete().eq('id', reserved.id)
        failed++
      }
    }

    return NextResponse.json({ sent, failed, excluded })
  } catch (error) {
    console.error('Invite send error:', error)
    return NextResponse.json({ error: 'Failed to send invites' }, { status: 500 })
  }
}
