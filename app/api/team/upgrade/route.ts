import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getBrokerageContext, getSeatUsage } from '@/lib/team'
import { stripe, getPriceConfig, type BillingInterval } from '@/lib/stripe'
import { isValidSeatCount, totalCents, MIN_BROKERAGE_SEATS, MAX_BROKERAGE_SEATS } from '@/lib/billing-plans'

// POST { seats }: upgrade a flat Team plan (2–10 agents, $120/mo) to the
// per-seat Brokerage plan (11–100 agents, $11/agent/mo) IN PLACE — the
// existing Stripe subscription's item is swapped to the per-seat price at the
// SAME billing interval, so there's no second subscription, no gap, and the
// double-billing checkout guard never fights it. Stripe charges the prorated
// difference immediately; a declined card aborts the whole upgrade atomically.
// The subscription's metadata.tier flips to 'brokerage', so every subsequent
// webhook event maintains the brokerage row + seat sync automatically.
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'team-upgrade', 10, 3600)
    if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const ctx = await getBrokerageContext(user.id)
    if (!ctx) return NextResponse.json({ error: 'No team found' }, { status: 404 })
    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'Only the team lead can upgrade the plan' }, { status: 403 })
    }
    if (ctx.tier !== 'team') {
      return NextResponse.json({ error: 'Your plan is already per-seat — manage seats from the Team tab.' }, { status: 409 })
    }

    const body = await request.json().catch(() => ({}))
    const seats = Number(body?.seats)
    if (!isValidSeatCount(seats)) {
      return NextResponse.json(
        { error: `Per-seat plans cover ${MIN_BROKERAGE_SEATS}–${MAX_BROKERAGE_SEATS} agents. For more than ${MAX_BROKERAGE_SEATS}, contact us.` },
        { status: 400 }
      )
    }
    const usage = await getSeatUsage(ctx.brokerageId)
    if (seats < usage.used) {
      return NextResponse.json(
        { error: `You're currently using ${usage.used} seats — choose at least that many.` },
        { status: 409 }
      )
    }

    // The team's funding subscription: recorded on the brokerage by the
    // webhook, falling back to the owner's profile right after checkout.
    let subId = ctx.stripeSubscriptionId
    if (!subId) {
      const { data: owner } = await supabase
        .from('profiles')
        .select('stripe_subscription_id')
        .eq('id', ctx.ownerId)
        .maybeSingle()
      subId = owner?.stripe_subscription_id ?? null
    }
    if (!subId) {
      // Legacy one-time 2-year Team prepay (or a comped/admin-provisioned
      // team): there's no subscription to modify. Handled personally.
      return NextResponse.json(
        { error: "Your prepaid Team plan can't be upgraded automatically — email support@ohaccess.com and we'll set it up for you." },
        { status: 409 }
      )
    }

    const sub = await stripe.subscriptions.retrieve(subId)
    const item = sub.items.data[0]
    if (!item) return NextResponse.json({ error: 'Subscription has no items' }, { status: 500 })

    // Same interval as they're on today — month stays month, year stays year,
    // 2-year stays 2-year. Changing terms is a separate decision, not a side
    // effect of adding an 11th agent.
    const rec = item.price.recurring
    const interval: BillingInterval =
      !rec || rec.interval === 'month' ? 'month' : rec.interval_count === 2 ? 'two_year_prepay' : 'year'
    const cfg = getPriceConfig('brokerage', interval)

    await stripe.subscriptions.update(subId, {
      items: [{ id: item.id, price: cfg.priceId, quantity: seats }],
      proration_behavior: 'always_invoice', // charge the difference now
      payment_behavior: 'error_if_incomplete', // decline -> nothing changes
      metadata: { ...sub.metadata, tier: 'brokerage', seats: String(seats) },
    })

    // Optimistic; the customer.subscription.updated webhook re-confirms from
    // the authoritative (fresh-retrieved) subscription state.
    await supabase
      .from('brokerages')
      .update({ tier: 'brokerage', seat_limit: seats })
      .eq('id', ctx.brokerageId)
    await supabase.from('profiles').update({ tier: 'brokerage' }).eq('id', ctx.ownerId)

    return NextResponse.json({
      success: true,
      seats,
      interval,
      newTotalCents: totalCents(seats, interval),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not upgrade the plan'
    const isCardError = typeof error === 'object' && error !== null && (error as { type?: string }).type === 'StripeCardError'
    console.error('Team upgrade error:', error)
    return NextResponse.json(
      { error: isCardError ? `Payment failed: ${message} Your plan was not changed.` : message },
      { status: isCardError ? 402 : 500 }
    )
  }
}
