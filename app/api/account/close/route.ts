import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { decideAccountClosure, buildAccountClosureEmail } from '@/lib/account-closure'
import { deleteAgentAccount, AccountLegalHoldError, AccountArchiveError } from '@/lib/delete-account'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

// The agent's own Close-account button (Settings → Close account).
//   POST   { confirmEmail }  -> close: delete now, or schedule for the end of
//                               the paid period (lib/account-closure decides)
//   DELETE                   -> "Keep my account": clear a scheduled closure
//
// Scheduling also stops the Stripe subscription renewing (cancel_at_period_end)
// so the agent is never billed past the date they were told. Keeping the
// account does NOT resume that subscription: the Subscription card offers
// Resume separately, and silently re-enabling a charge would be worse than
// leaving them to click it.
const PROFILE_COLS =
  'id, email, full_name, tier, billing_interval, stripe_subscription_id, current_period_end, subscription_canceled_at, deletion_scheduled_at'

async function sendClosureEmail(profile: { email: string | null; full_name: string | null }, decision: ReturnType<typeof decideAccountClosure>) {
  if (!profile.email) return
  try {
    const { subject, html } = buildAccountClosureEmail({
      firstName: String(profile.full_name || '').trim().split(/\s+/)[0],
      decision,
      appUrl: APP_URL,
    })
    const resend = new Resend(process.env.RESEND_API_KEY!)
    await resend.emails.send({
      from: 'ohACCESS <noreply@mail.ohaccess.com>',
      to: profile.email,
      replyTo: 'support@ohaccess.com',
      subject,
      html,
    })
  } catch (e) {
    console.error('[ACCOUNT-CLOSE] confirmation email failed', e)
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = getClientIp(request)
  const limit = await checkRateLimit(`ip:${ip}`, 'account-close', 10, 3600)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  // Admin logins are torn down by hand, never from a dashboard button.
  if (isAdmin(user.email)) {
    return NextResponse.json({ error: 'Admin accounts cannot be closed from here.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { data: profile } = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const confirm = String(body?.confirmEmail || '').trim().toLowerCase()
  if (!confirm || confirm !== String(profile.email || '').toLowerCase()) {
    return NextResponse.json({ error: 'Please type the email address on your account to confirm.' }, { status: 400 })
  }

  const decision = decideAccountClosure(profile)

  if (decision.mode === 'scheduled') {
    if (decision.cancelStripe && profile.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(profile.stripe_subscription_id, { cancel_at_period_end: true })
      } catch (e) {
        console.error('[ACCOUNT-CLOSE] Stripe cancel failed', e)
        return NextResponse.json(
          { error: 'Could not stop your subscription renewing. Nothing was changed; please try again or email support@ohaccess.com.' },
          { status: 502 }
        )
      }
    }
    const { error } = await supabase
      .from('profiles')
      .update({
        deletion_scheduled_at: decision.at,
        ...(decision.cancelStripe ? { subscription_canceled_at: decision.at } : {}),
      })
      .eq('id', user.id)
    if (error) {
      console.error('[ACCOUNT-CLOSE] schedule write failed', error)
      return NextResponse.json({ error: 'Could not schedule the closure. Please try again.' }, { status: 500 })
    }
    console.log(`[ACCOUNT-CLOSE] ${profile.email} scheduled for ${decision.at}`)
    await sendClosureEmail(profile, decision)
    return NextResponse.json({ scheduled: decision.at })
  }

  // Immediate: the email goes first because the address is gone once the
  // profile row is.
  await sendClosureEmail(profile, decision)
  try {
    await deleteAgentAccount(user.id, profile, 'self')
  } catch (e) {
    if (e instanceof AccountLegalHoldError) {
      return NextResponse.json(
        { error: 'Your account cannot be closed automatically right now. Please email support@ohaccess.com and we will take care of it.' },
        { status: 409 }
      )
    }
    if (e instanceof AccountArchiveError) {
      return NextResponse.json({ error: 'Something went wrong and nothing was deleted. Please try again.' }, { status: 500 })
    }
    return NextResponse.json(
      { error: 'Closing your account did not fully complete. Please email support@ohaccess.com so we can finish it for you.' },
      { status: 500 }
    )
  }
  return NextResponse.json({ deleted: true })
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, deletion_scheduled_at')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (!profile.deletion_scheduled_at) return NextResponse.json({ kept: true })

  const { error } = await supabase
    .from('profiles')
    .update({ deletion_scheduled_at: null })
    .eq('id', user.id)
  if (error) {
    console.error('[ACCOUNT-CLOSE] keep failed', error)
    return NextResponse.json({ error: 'Could not update your account. Please try again.' }, { status: 500 })
  }
  console.log(`[ACCOUNT-CLOSE] ${profile.email} kept their account (was ${profile.deletion_scheduled_at})`)
  return NextResponse.json({ kept: true })
}
