import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/auth'
import { stripe, getPriceConfig, isTier, isBillingInterval } from '@/lib/stripe'
import { isValidSeatCount, isExpiredPrepaidAccess, isComped, MIN_BROKERAGE_SEATS, MAX_BROKERAGE_SEATS } from '@/lib/billing-plans'
import { HARDWARE_OFFER_ACTIVE, HARDWARE_CHOICES } from '@/lib/hardware-offer'

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

    // A LEGACY (one-time) 2-year prepay or admin comp that has lapsed still
    // reads tier=paid/status=active locally, so let those users renew/buy.
    // Real subscriptions carry a sub id and auto-renew — never "expired".
    const prepaidExpired = isExpiredPrepaidAccess(profile)

    // Block double-paying. If they already have an active paid subscription,
    // route them to the customer portal instead of starting a second checkout.
    // An ACTIVE admin comp (gifted access, no Stripe sub) is deliberately NOT
    // blocked — a comped agent choosing to pay mid-gift is a conversion we
    // want; the webhook overwrites the comp fields when the sub lands.
    const activeStatuses = ['active', 'trialing', 'past_due']
    if (
      profile.tier !== 'free' &&
      activeStatuses.includes(profile.subscription_status ?? '') &&
      !prepaidExpired &&
      !isComped(profile)
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

    // Free sign-hardware offer (terms §4.9): individual Pro 2-year purchases
    // only, one claim per account ever. When eligible, Stripe Checkout itself
    // collects the US shipping address and the stand-vs-A-frame choice; the
    // webhook records the claim. The per-state cap is enforced by the
    // marketing display going away as states fill — a buyer who reaches
    // checkout with the fields attached is always honored.
    let hardwareOffer = false
    if (HARDWARE_OFFER_ACTIVE && tier === 'pro' && interval === 'two_year_prepay') {
      const { data: priorClaim } = await supabase
        .from('hardware_claims')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle()
      hardwareOffer = !priorClaim
    }

    // Every plan is a subscription now — the 2-year term included (it's a
    // real interval=year×2 subscription that auto-renews; the old one-time
    // payment flow is gone, and legacy holders are handled by the guards above).
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: cfg.priceId, quantity: seatCount }],
      // {CHECKOUT_SESSION_ID} is filled in by Stripe; the dashboard trades it
      // for the paid amount to report the purchase to the ad platforms.
      success_url: `${APP_URL}/dashboard?view=settings&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/dashboard?view=settings&checkout=cancel`,
      allow_promotion_codes: true,
      // metadata travels through to the webhook so we know what to provision
      metadata: {
        profile_id: user.id,
        tier,
        billing_interval: interval,
        ...(tier === 'brokerage' ? { seats: String(seatCount) } : {}),
        ...(hardwareOffer ? { hardware_offer: 'true' } : {}),
      },
      subscription_data: {
        metadata: {
          profile_id: user.id,
          tier,
          billing_interval: interval,
          ...(tier === 'brokerage' ? { seats: String(seatCount) } : {}),
        },
      },
      ...(hardwareOffer
        ? {
            shipping_address_collection: { allowed_countries: ['US'] },
            custom_fields: [
              {
                key: 'hardware_choice',
                type: 'dropdown',
                label: { type: 'custom', custom: 'Your free sign hardware' },
                dropdown: {
                  options: [
                    { value: 'pedestal_pair', label: HARDWARE_CHOICES.pedestal_pair },
                    { value: 'a_frame', label: HARDWARE_CHOICES.a_frame },
                  ],
                },
              },
            ],
            custom_text: {
              shipping_address: {
                message: 'Your free sign hardware ships to this address (US only).',
              },
            },
          }
        : {}),
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
