import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

interface ProfileUpdate {
  tier?: 'free' | 'pro' | 'team' | 'brokerage'
  stripe_subscription_id?: string | null
  subscription_status?: string | null
  billing_interval?: string | null
  current_period_end?: string | null
  subscription_canceled_at?: string | null
}

async function findProfileId(
  metadataProfileId: string | undefined,
  customerId: string | undefined
): Promise<string | null> {
  if (metadataProfileId) return metadataProfileId
  if (!customerId) return null
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return data?.id ?? null
}

async function updateProfile(profileId: string, update: ProfileUpdate) {
  const { error } = await supabase.from('profiles').update(update).eq('id', profileId)
  if (error) {
    console.error('Profile update failed', { profileId, error })
    throw error
  }
}

// Ensure the Team subscriber owns a `brokerages` row and is linked to it
// as brokerage_admin. Idempotent: if they already own a team brokerage we
// just return its id. Called after a successful Team checkout.
async function ensureTeamBrokerage(profileId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, brokerage_id, full_name, email')
    .eq('id', profileId)
    .single()
  if (!profile) return null

  if (profile.brokerage_id) {
    const { data: existing } = await supabase
      .from('brokerages')
      .select('id, owner_id, tier')
      .eq('id', profile.brokerage_id)
      .maybeSingle()
    if (existing && existing.owner_id === profileId) {
      return existing.id
    }
  }

  const defaultName =
    profile.full_name?.trim() ||
    (profile.email ? `${profile.email.split('@')[0]}'s Team` : 'My Team')

  const { data: brokerage, error: createErr } = await supabase
    .from('brokerages')
    .insert({
      name: defaultName,
      owner_id: profileId,
      tier: 'team',
      seat_limit: 10,
    })
    .select('id')
    .single()

  let brokerageId = brokerage?.id ?? null

  // 23505 = unique violation: a concurrent webhook event already created the
  // brokerage for this owner. Fetch the winner instead of erroring out.
  if (createErr) {
    if ((createErr as { code?: string }).code === '23505') {
      const { data: existing } = await supabase
        .from('brokerages')
        .select('id')
        .eq('owner_id', profileId)
        .maybeSingle()
      brokerageId = existing?.id ?? null
    } else {
      console.error('Failed to create brokerage for team subscriber', { profileId, createErr })
      return null
    }
  }

  if (!brokerageId) return null

  await supabase
    .from('profiles')
    .update({ brokerage_id: brokerageId, role: 'brokerage_admin' })
    .eq('id', profileId)

  return brokerageId
}

function isoOrNull(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null
  return new Date(unixSeconds * 1000).toISOString()
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const profileId = await findProfileId(
    session.metadata?.profile_id,
    typeof session.customer === 'string' ? session.customer : session.customer?.id
  )
  if (!profileId) {
    console.error('checkout.session.completed: could not resolve profile', session.id)
    return
  }

  const tier = (session.metadata?.tier ?? 'pro') as 'pro' | 'team'
  const interval = session.metadata?.billing_interval ?? null

  if (session.mode === 'subscription' && session.subscription) {
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
    const sub = await stripe.subscriptions.retrieve(subId)
    await updateProfile(profileId, {
      tier,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      billing_interval: interval,
      current_period_end: isoOrNull(sub.items.data[0]?.current_period_end ?? null),
      subscription_canceled_at: null,
    })
  } else if (session.mode === 'payment') {
    // 2-year prepay: one-time charge, grant access for N days.
    const days = Number(session.metadata?.access_duration_days ?? 0)
    const periodEnd = days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null
    await updateProfile(profileId, {
      tier,
      stripe_subscription_id: null,
      subscription_status: 'active',
      billing_interval: interval,
      current_period_end: periodEnd,
      subscription_canceled_at: null,
    })
  }

  // Team buyers become owners of a brokerage row (seat_limit 10), so they get
  // the team-admin dashboard. Idempotent on retry.
  if (tier === 'team') {
    await ensureTeamBrokerage(profileId)
  }
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const profileId = await findProfileId(
    sub.metadata?.profile_id,
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  )
  if (!profileId) {
    console.error('subscription event: could not resolve profile', sub.id)
    return
  }

  // For active/trialing/past_due, keep them at the paid tier; for canceled/unpaid/incomplete_expired, downgrade.
  const liveStatuses = new Set(['active', 'trialing', 'past_due'])
  const tier = liveStatuses.has(sub.status)
    ? ((sub.metadata?.tier ?? 'pro') as 'pro' | 'team')
    : 'free'

  await updateProfile(profileId, {
    tier,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    billing_interval: sub.metadata?.billing_interval ?? null,
    current_period_end: isoOrNull(sub.items.data[0]?.current_period_end ?? null),
    subscription_canceled_at: sub.canceled_at ? isoOrNull(sub.canceled_at) : null,
  })

  // Belt-and-suspenders: if checkout.session.completed was missed but the
  // subscription event arrived, still provision the brokerage.
  if (tier === 'team') {
    await ensureTeamBrokerage(profileId)
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const profileId = await findProfileId(
    sub.metadata?.profile_id,
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  )
  if (!profileId) return
  await updateProfile(profileId, {
    tier: 'free',
    stripe_subscription_id: null,
    subscription_status: 'canceled',
    subscription_canceled_at: new Date().toISOString(),
  })
}

export async function POST(request: Request) {
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const body = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid signature'
    console.error('Webhook signature verification failed:', message)
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  // Idempotency: record the event ID. If we've seen it before, return 200 fast.
  const { error: insertError } = await supabase
    .from('stripe_events')
    .insert({ id: event.id, type: event.type, payload: event as unknown as object })

  if (insertError) {
    // 23505 = unique_violation = duplicate event, safe to ignore.
    if ((insertError as { code?: string }).code === '23505') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error('Failed to record stripe event', insertError)
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      default:
        // Ignore other event types — they're harmless but we record them
        // in stripe_events for debugging.
        break
    }
  } catch (err) {
    console.error('Webhook handler error:', event.type, err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
