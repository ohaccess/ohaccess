import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { escapeHtml } from '@/lib/escape-html'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ohaccess.com'
const INVITE_TTL_DAYS = 7
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function getSponsorForUser(userId: string) {
  const { data } = await supabase
    .from('sponsors')
    .select('id, full_name, company, seat_limit')
    .eq('owner_id', userId)
    .maybeSingle()
  return data
}

// GET: the sponsor's pending invites + currently linked agents.
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sponsor = await getSponsorForUser(user.id)
  if (!sponsor) return NextResponse.json({ error: 'No sponsor profile found' }, { status: 404 })

  const { data: invites } = await supabase
    .from('sponsor_invitations')
    .select('id, email, expires_at, created_at')
    .eq('sponsor_id', sponsor.id)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  const { data: agents } = await supabase
    .from('profiles')
    .select('id, full_name, email, brokerage')
    .eq('sponsor_id', sponsor.id)
    .order('full_name', { ascending: true })

  return NextResponse.json({
    invites: invites ?? [],
    agents: agents ?? [],
    seatLimit: sponsor.seat_limit ?? 10,
  })
}

// POST: invite an agent by email. The agent must explicitly accept before the
// sponsorship shows anywhere.
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sponsor = await getSponsorForUser(user.id)
  if (!sponsor) {
    return NextResponse.json({ error: 'Set up your sponsor profile before inviting agents' }, { status: 404 })
  }
  if (!sponsor.full_name) {
    return NextResponse.json({ error: 'Add your name to your sponsor profile before inviting agents' }, { status: 400 })
  }

  // Guard against blasting invites (Resend cost + spam reputation).
  const limit = await checkRateLimit(`sponsor:${sponsor.id}`, 'sponsor-invite', 20, 3600)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many invites sent. Try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }

  // Seat cap: accepted agents + pending invites vs the sponsor's own limit
  // (default 10 = the flat Team-equivalent plan; raised per sponsor when
  // they move to per-seat pricing — no code change needed).
  const seatLimit = sponsor.seat_limit ?? 10
  const { count: agentCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('sponsor_id', sponsor.id)
  const { count: pendingCount } = await supabase
    .from('sponsor_invitations')
    .select('*', { count: 'exact', head: true })
    .eq('sponsor_id', sponsor.id)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
  if ((agentCount ?? 0) + (pendingCount ?? 0) >= seatLimit) {
    return NextResponse.json(
      { error: `Your sponsorship covers up to ${seatLimit} agents. Remove an agent or revoke a pending invite first — or contact support@ohaccess.com to add seats.` },
      { status: 409 }
    )
  }

  // Already sponsored by this sponsor?
  const { data: existingAgent } = await supabase
    .from('profiles')
    .select('id, sponsor_id')
    .ilike('email', email)
    .maybeSingle()
  if (existingAgent?.sponsor_id === sponsor.id) {
    return NextResponse.json({ error: 'You already sponsor that agent' }, { status: 409 })
  }

  // Already has a pending invite from this sponsor?
  const { data: existingInvite } = await supabase
    .from('sponsor_invitations')
    .select('id')
    .eq('sponsor_id', sponsor.id)
    .ilike('email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (existingInvite) {
    return NextResponse.json({ error: 'An invite is already pending for that email' }, { status: 409 })
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString()

  const { error: insertErr } = await supabase.from('sponsor_invitations').insert({
    sponsor_id: sponsor.id,
    email,
    token,
    invited_by: user.id,
    expires_at: expiresAt,
  })
  if (insertErr) {
    console.error('Sponsor invite insert failed', insertErr)
    return NextResponse.json({ error: 'Could not create invite' }, { status: 500 })
  }

  const acceptUrl = `${APP_URL}/sponsor-invite?token=${token}`
  const sponsorLabel = escapeHtml(
    sponsor.company ? `${sponsor.full_name} (${sponsor.company})` : sponsor.full_name
  )

  try {
    await resend.emails.send({
      from: 'ohACCESS <noreply@mail.ohaccess.com>',
      to: email,
      replyTo: 'support@ohaccess.com',
      subject: `${sponsor.full_name} wants to sponsor your ohACCESS account`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 20px;">
          <div style="background: #1d1d1f; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
            <div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
          </div>
          <div style="background: white; border-radius: 0 0 16px 16px; padding: 24px; text-align: center;">
            <div style="font-size: 18px; font-weight: 700; color: #1d1d1f; margin-bottom: 8px;">
              ${sponsorLabel} wants to sponsor your account
            </div>
            <p style="font-size: 14px; color: #6e6e73; line-height: 1.6; margin-bottom: 24px;">
              If you accept, your sponsor's card (photo, contact info, and logo) will appear below
              yours in the emails your open-house visitors receive, and the sign-in form will name
              them in the visitor consent language. You can remove the sponsorship anytime from
              your Settings tab.
            </p>
            <a href="${escapeHtml(acceptUrl)}" style="display: inline-block; background: #c9963a; color: #1d1d1f; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 700; text-decoration: none;">
              Review &amp; accept →
            </a>
            <p style="font-size: 12px; color: #aeaeb2; margin-top: 24px; line-height: 1.6;">
              This invitation expires in ${INVITE_TTL_DAYS} days.<br/>
              If you weren't expecting this, you can safely ignore this email — nothing changes
              on your account unless you accept.
            </p>
          </div>
        </div>
      `,
    })
  } catch (e) {
    console.error('Sponsor invite email send failed', e)
    // Roll back so a dead email address doesn't leave a phantom pending invite.
    await supabase.from('sponsor_invitations').delete().eq('token', token)
    return NextResponse.json({ error: 'Could not send the invite email' }, { status: 502 })
  }

  return NextResponse.json({ success: true, email })
}
