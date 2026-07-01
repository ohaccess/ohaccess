import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

async function lookupInvite(token: string) {
  const { data } = await supabase
    .from('brokerage_invitations')
    .select('id, brokerage_id, email, role, expires_at, accepted_at, brokerages(name, tier, primary_color, accent_color, logo_url)')
    .eq('token', token)
    .maybeSingle()
  return data
}

// GET: public lookup so the accept-invite page can show who's inviting and
// pre-fill / lock the email. Does not require auth.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!token) return NextResponse.json({ valid: false, reason: 'missing' }, { status: 400 })

  const invite = await lookupInvite(token)
  if (!invite) return NextResponse.json({ valid: false, reason: 'not_found' })
  if (invite.accepted_at) return NextResponse.json({ valid: false, reason: 'used' })
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' })
  }

  const brokerage = invite.brokerages as unknown as { name: string } | null
  return NextResponse.json({
    valid: true,
    email: invite.email,
    teamName: brokerage?.name ?? 'a team',
  })
}

// POST: finalize acceptance. Requires the user to be authenticated AND for
// their email to match the invited email (prevents invite hijacking).
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Please sign in to accept this invite' }, { status: 401 })

  const { token } = await request.json()
  if (typeof token !== 'string' || !token) {
    return NextResponse.json({ error: 'Missing invite token' }, { status: 400 })
  }

  const invite = await lookupInvite(token)
  if (!invite) return NextResponse.json({ error: 'This invitation is invalid' }, { status: 404 })
  if (invite.accepted_at) {
    return NextResponse.json({ error: 'This invitation has already been used' }, { status: 409 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 })
  }

  const userEmail = (user.email ?? '').toLowerCase()
  if (userEmail !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { error: `This invite is for ${invite.email}. Sign in with that email to accept.` },
      { status: 403 }
    )
  }

  // Link the profile to the brokerage as an agent, and inherit the team's
  // tier so the member gets Pro-level features (SMS alerts, email CC, no cap).
  // Also mirror the team's branding onto the profile so the member's visitor
  // pages/emails carry team colors + logo.
  const brokerage = invite.brokerages as unknown as {
    name: string; tier: 'team' | 'brokerage'
    primary_color: string | null; accent_color: string | null; logo_url: string | null
  } | null
  const profileUpdate: Record<string, unknown> = {
    brokerage_id: invite.brokerage_id,
    role: invite.role,
    tier: brokerage?.tier ?? 'team',
  }
  if (brokerage?.name) profileUpdate.brokerage = brokerage.name
  if (brokerage?.primary_color) profileUpdate.primary_color = brokerage.primary_color
  if (brokerage?.accent_color) profileUpdate.accent_color = brokerage.accent_color
  if (brokerage?.logo_url) profileUpdate.logo_url = brokerage.logo_url
  const { error: profileErr } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', user.id)
  if (profileErr) {
    console.error('Accept invite: profile update failed', profileErr)
    return NextResponse.json({ error: 'Could not join the team' }, { status: 500 })
  }

  await supabase
    .from('brokerage_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  // If this person was already paying for their own Pro/Team subscription,
  // the team now covers them — schedule their personal subscription to cancel
  // at period end so they aren't double-charged. They keep what they already
  // paid for; it just won't renew. (A 2-year prepay is a one-time payment with
  // no subscription to cancel, so it's naturally skipped.) Non-fatal: if Stripe
  // hiccups, they're still on the team and an admin can resolve it from /admin.
  let personalSubsCanceled = 0
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()
    if (prof?.stripe_customer_id) {
      const subs = await stripe.subscriptions.list({
        customer: prof.stripe_customer_id,
        status: 'all',
        limit: 100,
      })
      const billing = new Set(['active', 'trialing', 'past_due'])
      for (const sub of subs.data) {
        if (billing.has(sub.status) && !sub.cancel_at_period_end) {
          await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true })
          personalSubsCanceled++
        }
      }
    }
  } catch (e) {
    console.error('Accept invite: failed to cancel personal subscription', e)
  }

  return NextResponse.json({ success: true, personalSubsCanceled })
}
