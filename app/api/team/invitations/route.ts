import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { getAuthenticatedUser } from '@/lib/auth'
import { getBrokerageContext, getSeatUsage } from '@/lib/team'
import { checkRateLimit } from '@/lib/rate-limit'
import { escapeHtml } from '@/lib/escape-html'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ohaccess.com'
const INVITE_TTL_DAYS = 7
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST: invite an agent by email. Admin only, seat-limited, rate-limited.
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getBrokerageContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No team found' }, { status: 404 })
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'Only the team lead can invite agents' }, { status: 403 })
  }

  // Guard against an admin blasting invites (Resend cost + spam reputation).
  const limit = await checkRateLimit(`team:${ctx.brokerageId}`, 'team-invite', 50, 3600)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many invites sent. Try again later.' }, { status: 429 })
  }

  const body = await request.json()
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }

  // Already a member of this team?
  const { data: existingMember } = await supabase
    .from('profiles')
    .select('id, brokerage_id')
    .ilike('email', email)
    .maybeSingle()
  if (existingMember?.brokerage_id === ctx.brokerageId) {
    return NextResponse.json({ error: 'That person is already on your team' }, { status: 409 })
  }

  // Already has a pending invite to this team?
  const { data: existingInvite } = await supabase
    .from('brokerage_invitations')
    .select('id')
    .eq('brokerage_id', ctx.brokerageId)
    .ilike('email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (existingInvite) {
    return NextResponse.json({ error: 'An invite is already pending for that email' }, { status: 409 })
  }

  // Seat check.
  const usage = await getSeatUsage(ctx.brokerageId)
  if (usage.used >= usage.limit) {
    return NextResponse.json(
      { error: `Your team is full (${usage.limit} seats). Remove a member or a pending invite first.` },
      { status: 409 }
    )
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString()

  const { error: insertErr } = await supabase.from('brokerage_invitations').insert({
    brokerage_id: ctx.brokerageId,
    email,
    role: 'agent',
    token,
    invited_by: user.id,
    expires_at: expiresAt,
  })
  if (insertErr) {
    console.error('Invite insert failed', insertErr)
    return NextResponse.json({ error: 'Could not create invite' }, { status: 500 })
  }

  const acceptUrl = `${APP_URL}/accept-invite?token=${token}`
  const teamName = escapeHtml(ctx.name)

  try {
    await resend.emails.send({
      from: 'ohACCESS <noreply@mail.ohaccess.com>',
      to: email,
      // Replies reach a monitored inbox instead of bouncing off the send-only
      // noreply subdomain.
      replyTo: 'support@ohaccess.com',
      subject: `You're invited to join ${ctx.name} on ohACCESS`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 20px;">
          <div style="background: #1d1d1f; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
            <div style="font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
          </div>
          <div style="background: white; border-radius: 0 0 16px 16px; padding: 24px; text-align: center;">
            <div style="font-size: 18px; font-weight: 700; color: #1d1d1f; margin-bottom: 8px;">
              You're invited to join ${teamName}
            </div>
            <p style="font-size: 14px; color: #6e6e73; line-height: 1.6; margin-bottom: 24px;">
              Your team lead has invited you to ohACCESS — verified open-house sign-ins for real estate agents.
              Click below to set up your account and start verifying visitors.
            </p>
            <a href="${escapeHtml(acceptUrl)}" style="display: inline-block; background: #c9963a; color: #1d1d1f; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 700; text-decoration: none;">
              Accept invitation →
            </a>
            <p style="font-size: 12px; color: #aeaeb2; margin-top: 24px; line-height: 1.6;">
              This invitation expires in ${INVITE_TTL_DAYS} days.<br/>
              If you weren't expecting this, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    })
  } catch (e) {
    console.error('Invite email send failed', e)
    // Roll back the invite so the seat isn't consumed by an email that never arrived.
    await supabase.from('brokerage_invitations').delete().eq('token', token)
    return NextResponse.json({ error: 'Could not send the invite email' }, { status: 502 })
  }

  return NextResponse.json({ success: true, email })
}
