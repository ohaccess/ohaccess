import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

const BILLING_STATUSES = new Set(['active', 'trialing', 'past_due'])

// Cancel (at period end) the personal Stripe subscription(s) of a team member
// who is being double-charged — the brokerage already covers their seat. The
// team's own subscription belongs to the OWNER's Stripe customer, never the
// member's, so every subscription on a member's customer is personal and safe
// to wind down. The webhook keeps them on the team tier when the sub ends.
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await request.json().catch(() => ({}))
  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, brokerage_id, role, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()
  if (error || !profile) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }
  if (!profile.brokerage_id) {
    return NextResponse.json(
      { error: 'This account is not on a team, so canceling their subscription would simply downgrade them. Use the regular billing tools instead.' },
      { status: 400 }
    )
  }
  if (profile.role === 'brokerage_admin') {
    return NextResponse.json(
      { error: "This account owns the team — its subscription IS the team's. Don't cancel it here." },
      { status: 400 }
    )
  }
  if (!profile.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No Stripe customer on file — nothing to cancel.' },
      { status: 400 }
    )
  }

  let canceled = 0
  try {
    const subs = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'all',
      limit: 100,
    })
    for (const sub of subs.data) {
      if (BILLING_STATUSES.has(sub.status) && !sub.cancel_at_period_end) {
        await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true })
        canceled++
      }
    }
  } catch (e) {
    console.error('resolve-double-billing: Stripe error', e)
    return NextResponse.json({ error: 'Stripe call failed — see logs.' }, { status: 502 })
  }

  // Reflect the scheduled cancellation immediately so the admin flag clears
  // without waiting for the webhook round-trip.
  if (canceled > 0) {
    await supabase
      .from('profiles')
      .update({ subscription_canceled_at: new Date().toISOString() })
      .eq('id', userId)
  }

  console.log(
    `[admin] ${user.email} resolved double-billing for ${profile.email} (${userId}): ` +
      `${canceled} personal subscription(s) set to cancel at period end`
  )

  return NextResponse.json({ success: true, canceled, name: profile.full_name || profile.email })
}
