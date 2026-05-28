import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/auth'
import { stripe, getPriceConfig, isTier, isBillingInterval } from '@/lib/stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ohaccess.com'

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'stripe-checkout', 30, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { tier, interval } = await request.json()
    if (!isTier(tier) || !isBillingInterval(interval)) {
      return NextResponse.json({ error: 'Invalid tier or interval' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, stripe_customer_id, tier, subscription_status')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Block double-paying. If they already have an active paid subscription,
    // route them to the customer portal instead of starting a second checkout.
    const activeStatuses = ['active', 'trialing', 'past_due']
    if (profile.tier !== 'free' && activeStatuses.includes(profile.subscription_status ?? '')) {
      return NextResponse.json(
        { error: 'You already have an active subscription. Manage it from the dashboard.' },
        { status: 409 }
      )
    }

    let customerId = profile.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email ?? user.email ?? undefined,
        name: profile.full_name ?? undefined,
        metadata: { profile_id: user.id },
      })
      customerId = customer.id
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const cfg = getPriceConfig(tier, interval)

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: cfg.mode,
      line_items: [{ price: cfg.priceId, quantity: 1 }],
      success_url: `${APP_URL}/dashboard?view=settings&checkout=success`,
      cancel_url: `${APP_URL}/dashboard?view=settings&checkout=cancel`,
      allow_promotion_codes: true,
      // metadata travels through to the webhook so we know what to provision
      metadata: {
        profile_id: user.id,
        tier,
        billing_interval: interval,
        ...(cfg.accessDurationDays ? { access_duration_days: String(cfg.accessDurationDays) } : {}),
      },
      ...(cfg.mode === 'subscription'
        ? {
            subscription_data: {
              metadata: {
                profile_id: user.id,
                tier,
                billing_interval: interval,
              },
            },
          }
        : {
            payment_intent_data: {
              metadata: {
                profile_id: user.id,
                tier,
                billing_interval: interval,
                access_duration_days: String(cfg.accessDurationDays ?? 0),
              },
            },
          }),
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a session URL' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    const message = error instanceof Error ? error.message : 'Failed to start checkout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
