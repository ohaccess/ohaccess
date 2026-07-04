import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/auth'
import { stripe, getPriceConfig, isTier, isBillingInterval } from '@/lib/stripe'
import { isValidSeatCount, isExpiredLegacyTwoYear, MIN_BROKERAGE_SEATS, MAX_BROKERAGE_SEATS } from '@/lib/billing-plans'

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

    const { tier, interval, seats } = await request.json()
    if (!isTier(tier) || !isBillingInterval(interval)) {
      return NextResponse.json({ error: 'Invalid tier or interval' }, { status: 400 })
    }

    // Brokerage is per-seat: the seat count rides as the line-item quantity.
    // Self-serve range is 11–100; larger deals are negotiated via /contact.
    let seatCount = 1
    if (tier === 'brokerage') {
      const parsed = typeof seats === 'string' ? Number(seats) : seats
      if (!isValidSeatCount(parsed)) {
        return NextResponse.json(
          { error: `Brokerage plans cover ${MIN_BROKERAGE_SEATS}–${MAX_BROKERAGE_SEATS} agents. For more than ${MAX_BROKERAGE_SEATS}, contact us at ohaccess.com/contact.` },
          { status: 400 }
        )
      }
      seatCount = parsed
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, stripe_customer_id, stripe_subscription_id, tier, subscription_status, billing_interval, current_period_end')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // A LEGACY (one-time) 2-year prepay that has lapsed still reads
    // tier=paid/status=active locally, so let those users renew. New-style
    // 2-year subscriptions carry a sub id and auto-renew — never "expired".
    const twoYearExpired = isExpiredLegacyTwoYear(profile)

    // Block double-paying. If they already have an active paid subscription,
    // route them to the customer portal instead of starting a second checkout.
    const activeStatuses = ['active', 'trialing', 'past_due']
    if (
      profile.tier !== 'free' &&
      activeStatuses.includes(profile.subscription_status ?? '') &&
      !twoYearExpired
    ) {
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

    // Every plan is a subscription now — the 2-year term included (it's a
    // real interval=year×2 subscription that auto-renews; the old one-time
    // payment flow is gone, and legacy holders are handled by the guards above).
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: cfg.priceId, quantity: seatCount }],
      success_url: `${APP_URL}/dashboard?view=settings&checkout=success`,
      cancel_url: `${APP_URL}/dashboard?view=settings&checkout=cancel`,
      allow_promotion_codes: true,
      // metadata travels through to the webhook so we know what to provision
      metadata: {
        profile_id: user.id,
        tier,
        billing_interval: interval,
        ...(tier === 'brokerage' ? { seats: String(seatCount) } : {}),
      },
      subscription_data: {
        metadata: {
          profile_id: user.id,
          tier,
          billing_interval: interval,
          ...(tier === 'brokerage' ? { seats: String(seatCount) } : {}),
        },
      },
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
