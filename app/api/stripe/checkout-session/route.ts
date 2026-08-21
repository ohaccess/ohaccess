import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

// Summary of the caller's own completed Checkout Session — just enough for
// the dashboard to report the purchase (value + a stable id for de-duping)
// to the ad platforms after Stripe redirects back. Never trusts the amount
// from the URL: it comes straight from Stripe, after discounts and tax.
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'stripe-checkout-session', 30, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const id = new URL(request.url).searchParams.get('id') || ''
    if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.retrieve(id)
    // Sessions carry the buyer's profile id in metadata (set at creation);
    // anyone else's session reads as not found.
    if (session.metadata?.profile_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (session.status !== 'complete') {
      return NextResponse.json({ error: 'Checkout not complete' }, { status: 409 })
    }

    const tier = session.metadata?.tier
    const interval = session.metadata?.billing_interval
    return NextResponse.json({
      id: session.id,
      amount_total: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      plan: tier && interval ? `${tier}_${interval}` : null,
    })
  } catch (error) {
    console.error('Stripe checkout-session lookup error:', error)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
