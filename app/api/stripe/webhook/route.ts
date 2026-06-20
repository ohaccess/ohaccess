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

// True if the profile is linked to a brokerage (i.e. their features are
// covered by a team/brokerage). Used to avoid downgrading a covered member
// when their own personal subscription is canceled.
async function isBrokerageMember(profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('brokerage_id')
    .eq('id', profileId)
    .maybeSingle()
  return !!data?.brokerage_id
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

// Mirror the team owner's subscription status onto their brokerage row so
// members can see team billing health (drives the "contact your admin"
// banner). When the team's OWN subscription terminally ends, cut members loose:
// drop them to free, unlink from the brokerage, and clear the team's mirrored
// branding — KEEPING their account + all their data so they can start their own
// plan. `subId` MUST be the Stripe subscription id of the event; we only act
// when it matches the brokerage's recorded team subscription, so a different
// subscription on the same customer (or a stale/out-of-order event for an
// already-replaced subscription) can never tear down a live, paid team.
async function propagateTeamStatus(ownerProfileId: string, subId: string | null, status: string) {
  const { data: brokerage } = await supabase
    .from('brokerages')
    .select('id, stripe_subscription_id')
    .eq('owner_id', ownerProfileId)
    .maybeSingle()
  if (!brokerage) return // not a team owner — nothing to propagate

  // Ignore events for a subscription that isn't this team's (unless we haven't
  // recorded one yet, in which case the first event adopts it).
  const isThisTeamsSub = !brokerage.stripe_subscription_id || brokerage.stripe_subscription_id === subId
  if (!isThisTeamsSub) return

  // Only 'canceled'/'incomplete_expired' are terminal. 'unpaid' is a recoverable
  // dunning state (Stripe keeps retrying) — keep members on the team and let the
  // payment-failure banner prompt the admin, rather than irreversibly evicting
  // a team that may still pay.
  const terminal = new Set(['canceled', 'incomplete_expired'])
  const liveStatuses = new Set(['active', 'trialing', 'past_due'])

  const brokerageUpdate: Record<string, string | null> = { subscription_status: status }
  // Record/refresh the team's subscription id while alive (so future terminal
  // events can be matched), and CLEAR it on teardown so a later re-subscribe —
  // which always has a brand-new sub id — is re-adopted instead of being
  // rejected by the isThisTeamsSub check above.
  if (liveStatuses.has(status) && subId) brokerageUpdate.stripe_subscription_id = subId
  if (terminal.has(status)) brokerageUpdate.stripe_subscription_id = null
  await supabase.from('brokerages').update(brokerageUpdate).eq('id', brokerage.id)

  if (terminal.has(status)) {
    // Members → independent free agents, KEEPING their account, data, and their
    // own branding. (We don't null branding: those columns are per-agent and a
    // member may have set their own colors/logo, so erasing them is destructive.)
    await supabase
      .from('profiles')
      .update({ tier: 'free', brokerage_id: null, role: 'agent' })
      .eq('brokerage_id', brokerage.id)
      .neq('id', ownerProfileId)
    // Owner → consistent free state (role/link cleared). Keep the brokerage row
    // so a later re-subscribe reuses it (ensureTeamBrokerage re-links on the
    // owner_id unique-violation path; the nulled sub id lets propagateTeamStatus
    // re-adopt the new subscription).
    await supabase
      .from('profiles')
      .update({ role: 'agent', brokerage_id: null })
      .eq('id', ownerProfileId)
  }
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

  // A team member's feature tier is governed by their brokerage, NOT their own
  // personal subscription. So if this is a PERSONAL (non-team) subscription for
  // someone linked to a brokerage, leave their tier alone — otherwise canceling
  // a former-Pro member's personal plan would wrongly knock them off the team.
  const isTeamSub = sub.metadata?.tier === 'team'
  const isCoveredMember = !isTeamSub && (await isBrokerageMember(profileId))

  // A scheduled cancellation (cancel_at_period_end) doesn't set canceled_at
  // until the period actually ends, so surface cancel_at as the "ending on"
  // marker. Resuming (cancel_at_period_end=false) clears it.
  const subCanceledAt = sub.canceled_at
    ? isoOrNull(sub.canceled_at)
    : sub.cancel_at_period_end
      ? isoOrNull(sub.cancel_at)
      : null

  await updateProfile(profileId, {
    ...(isCoveredMember ? {} : { tier }),
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    billing_interval: sub.metadata?.billing_interval ?? null,
    current_period_end: isoOrNull(sub.items.data[0]?.current_period_end ?? null),
    subscription_canceled_at: subCanceledAt,
  })

  // For team subscriptions, keep the brokerage row + members in sync.
  // Provision on first activation; always mirror status (and cut members
  // loose if the team subscription has terminally lapsed).
  if (sub.metadata?.tier === 'team') {
    if (liveStatuses.has(sub.status)) {
      await ensureTeamBrokerage(profileId)
    }
    await propagateTeamStatus(profileId, sub.id, sub.status)
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const profileId = await findProfileId(
    sub.metadata?.profile_id,
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  )
  if (!profileId) return
  // Same guard as handleSubscriptionChange: when a brokerage member's PERSONAL
  // subscription finally ends, keep them on the team (the brokerage covers
  // them) instead of dropping them to free. Their team subscription ending is
  // handled below via propagateTeamStatus.
  const isTeamSub = sub.metadata?.tier === 'team'
  const isCoveredMember = !isTeamSub && (await isBrokerageMember(profileId))
  await updateProfile(profileId, {
    ...(isCoveredMember ? {} : { tier: 'free' }),
    stripe_subscription_id: null,
    subscription_status: 'canceled',
    subscription_canceled_at: new Date().toISOString(),
  })
  // If this deleted subscription was the team's, mark the team canceled and cut
  // members loose. propagateTeamStatus no-ops for solo subscribers and for a
  // non-team subscription that happens to share the owner's customer.
  await propagateTeamStatus(profileId, sub.id, 'canceled')
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
