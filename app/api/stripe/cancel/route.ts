import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

// POST: cancel (or resume) the current user's recurring subscription.
//   body { resume: true }  -> undo a pending cancellation
//   body { } / { resume:false } -> cancel at period end (keep access until then)
//
// Valid for any real subscription — month, year, and the (auto-renewing)
// 2-year term alike. LEGACY 2-year prepays were one-time payments with no
// subscription to cancel; they carry stripe_subscription_id = null, so the
// guard below already blocks them with the friendly prepaid-plan message.
// Stripe's customer.subscription.updated webhook is the source of truth; we
// also update the profile optimistically so the UI reflects it immediately.
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'stripe-cancel', 30, 3600)
    if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const body = await request.json().catch(() => ({}))
    const resume = body?.resume === true

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, billing_interval')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No cancelable subscription. A prepaid plan simply ends on its access date.' },
        { status: 400 }
      )
    }

    const sub = await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: !resume,
    })

    // Optimistic local update; the webhook will confirm.
    await supabase
      .from('profiles')
      .update({
        subscription_canceled_at: resume
          ? null
          : new Date((sub.cancel_at ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      })
      .eq('id', user.id)

    return NextResponse.json({
      success: true,
      resumed: resume,
      period_end: sub.items.data[0]?.current_period_end
        ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
        : null,
    })
  } catch (error) {
    console.error('Stripe cancel error:', error)
    const message = error instanceof Error ? error.message : 'Failed to update subscription'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
