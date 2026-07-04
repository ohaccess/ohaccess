import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { Resend } from 'resend'
import { stripe } from '@/lib/stripe'
import { escapeHtml } from '@/lib/escape-html'
import { notifyAdmins } from '@/lib/notify-admin'
import { ensureManagedBrokerage } from '@/lib/team'
import { MIN_BROKERAGE_SEATS } from '@/lib/billing-plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

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

// A "managed" subscription funds a whole team/brokerage (vs a personal Pro
// plan). Its owner gets a brokerages row via ensureManagedBrokerage (shared
// with the admin provisioning tool in lib/team.ts).
function isManagedTier(tier: string | undefined): tier is 'team' | 'brokerage' {
  return tier === 'team' || tier === 'brokerage'
}

// Resolve the tier + seat count for a managed subscription FROM STRIPE, not
// from the (possibly stale, out-of-order) event payload. The subscription
// item's quantity is the seat count for per-seat brokerage plans; flat Team
// stays at its historical 10 seats.
async function managedShapeFromStripe(subId: string): Promise<{ tier: 'team' | 'brokerage'; seatLimit: number } | null> {
  const fresh = await stripe.subscriptions.retrieve(subId)
  const tier = fresh.metadata?.tier
  if (!isManagedTier(tier)) return null
  const quantity = fresh.items.data[0]?.quantity ?? 0
  return {
    tier,
    seatLimit: tier === 'brokerage' ? Math.max(quantity, MIN_BROKERAGE_SEATS) : 10,
  }
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

  const tier = (session.metadata?.tier ?? 'pro') as 'pro' | 'team' | 'brokerage'
  const interval = session.metadata?.billing_interval ?? null
  let seatCount = 0

  if (session.mode === 'subscription' && session.subscription) {
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
    const sub = await stripe.subscriptions.retrieve(subId)
    seatCount = sub.items.data[0]?.quantity ?? 0
    await updateProfile(profileId, {
      tier,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      billing_interval: interval,
      current_period_end: isoOrNull(sub.items.data[0]?.current_period_end ?? null),
      subscription_canceled_at: null,
    })
  } else if (session.mode === 'payment') {
    // LEGACY branch: the 2-year term used to be sold as a one-time charge with
    // a locally computed access window. No new checkout produces payment mode
    // anymore (everything is a subscription) — this stays only so replaying a
    // historical event remains safe and correct.
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

  // Team/Brokerage buyers become owners of a brokerages row, so they get the
  // team-admin dashboard. Per-seat brokerages take their seat_limit from the
  // subscription quantity; flat Team keeps the historical 10. Idempotent on retry.
  if (isManagedTier(tier)) {
    await ensureManagedBrokerage(profileId, {
      tier,
      seatLimit: tier === 'brokerage' ? Math.max(seatCount, MIN_BROKERAGE_SEATS) : 10,
    })
  }

  // Internal heads-up: someone just subscribed / paid. This event is recorded
  // in stripe_events for idempotency, so it fires at most once per checkout.
  const { data: buyer } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', profileId)
    .maybeSingle()
  const amount =
    session.amount_total != null
      ? `${(session.amount_total / 100).toFixed(2)} ${String(session.currency || 'usd').toUpperCase()}`
      : '—'
  const planLabel =
    tier === 'brokerage' ? `Brokerage (${seatCount} seats)` : tier === 'team' ? 'Team' : 'Pro'
  const intervalLabel = interval ? ` (${interval.replace(/_/g, ' ')})` : ''
  await notifyAdmins(
    `💳 New ohACCESS subscription: ${buyer?.email ?? profileId}`,
    `<p>Someone just subscribed to ohACCESS.</p>
     <p><strong>Account:</strong> ${escapeHtml(buyer?.email ?? '')}<br/>
     <strong>Plan:</strong> ${escapeHtml(planLabel + intervalLabel)}<br/>
     <strong>Amount:</strong> ${escapeHtml(amount)}</p>`
  )
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
    ? ((sub.metadata?.tier ?? 'pro') as 'pro' | 'team' | 'brokerage')
    : 'free'

  // A team member's feature tier is governed by their brokerage, NOT their own
  // personal subscription. So if this is a PERSONAL (non-managed) subscription
  // for someone linked to a brokerage, leave their tier alone — otherwise
  // canceling a former-Pro member's personal plan would wrongly knock them off
  // the team. Managed (team/brokerage) subs are exempt: their OWNER also has
  // brokerage_id set, and their sub is exactly what funds the brokerage.
  const isManagedSub = isManagedTier(sub.metadata?.tier)
  const isCoveredMember = !isManagedSub && (await isBrokerageMember(profileId))

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

  // For managed (team/brokerage) subscriptions, keep the brokerage row +
  // members in sync. Provision on first activation and sync the seat count
  // from the CURRENT subscription state at Stripe — not this event's payload —
  // so a stale out-of-order event can never shrink seats or undo an upgrade.
  // Always mirror status (and cut members loose on terminal lapse).
  if (isManagedSub) {
    if (liveStatuses.has(sub.status)) {
      const shape = await managedShapeFromStripe(sub.id)
      if (shape) await ensureManagedBrokerage(profileId, shape)
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
  // them) instead of dropping them to free. Their team/brokerage subscription
  // ending is handled below via propagateTeamStatus.
  const isManagedSub = isManagedTier(sub.metadata?.tier)
  const isCoveredMember = !isManagedSub && (await isBrokerageMember(profileId))
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

// A renewal (or initial) charge failed. Notify the customer so they can fix
// their card before access is interrupted, and send an internal heads-up.
// Idempotent at the event level (stripe_events), so each failed attempt sends
// at most one email. Best-effort: never throw, so a mail hiccup doesn't cause
// Stripe to retry the whole webhook.
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  const profileId = await findProfileId(undefined, customerId)
  if (!profileId) {
    console.error('invoice.payment_failed: could not resolve profile', invoice.id)
    return
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', profileId)
    .maybeSingle()
  if (!profile?.email) {
    console.error('invoice.payment_failed: no email on profile', profileId)
    return
  }

  const name = escapeHtml((profile.full_name || '').trim() || 'there')
  const payUrl = invoice.hosted_invoice_url || `${APP_URL}/dashboard?view=settings`
  const manageUrl = `${APP_URL}/dashboard?view=settings`

  // Customer-facing notice
  try {
    await resend.emails.send({
      from: 'ohACCESS <noreply@mail.ohaccess.com>',
      to: profile.email,
      replyTo: 'support@ohaccess.com',
      subject: "Your ohACCESS payment didn't go through",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 20px;">
          <div style="background: #1d1d1f; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
            <div style="font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
          </div>
          <div style="background: white; border-radius: 0 0 16px 16px; padding: 24px; color: #1d1d1f; font-size: 14px; line-height: 1.6;">
            <p>Hi ${name},</p>
            <p>We tried to process your recent ohACCESS subscription payment, but it didn't go through.</p>
            <p>To keep your account active, please update your payment method or pay the outstanding invoice:</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${payUrl}" style="background: #c9963a; color: #1d1d1f; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700;">Update payment</a>
            </p>
            <p style="font-size: 13px; color: #6e6e73;">We'll automatically retry over the next few days. You can also manage your subscription anytime from your <a href="${manageUrl}" style="color: #0071e3;">dashboard settings</a>. If you think this is a mistake, just reply to this email.</p>
          </div>
        </div>
      `,
    })
  } catch (e) {
    console.error('invoice.payment_failed: customer email failed', e)
  }

  // Internal heads-up to billing, so churn signals are visible. Defaults to the
  // billing alias; override with BILLING_EMAILS (comma-separated) if needed.
  const billing = (process.env.BILLING_EMAILS || 'billing@ohaccess.com')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
  if (billing.length > 0) {
    const amount = ((invoice.amount_due ?? 0) / 100).toFixed(2)
    const currency = String(invoice.currency || 'usd').toUpperCase()
    try {
      await resend.emails.send({
        from: 'ohACCESS <noreply@mail.ohaccess.com>',
        to: billing,
        subject: `⚠️ Payment failed: ${profile.email}`,
        html: `<p>A subscription payment just failed.</p><p><strong>Account:</strong> ${escapeHtml(profile.email)}<br/><strong>Amount due:</strong> ${amount} ${currency}</p><p>Stripe will retry automatically. The customer has been emailed.</p>`,
      })
    } catch (e) {
      console.error('invoice.payment_failed: billing email failed', e)
    }
  }
}

// Advance notice that a subscription is about to renew and charge. Fires at
// the window configured in Stripe Billing settings ("Upcoming renewal events",
// set to ~30-45 days). Gated to annual/2-year plans — a monthly renewal email
// every month is noise, and several states require advance notice specifically
// for long terms. Idempotent via stripe_events on event.id (upcoming invoices
// themselves have no invoice id yet). Best-effort: never throws.
async function handleInvoiceUpcoming(invoice: Stripe.Invoice) {
  if (!invoice.amount_due) return // free/credit renewal — nothing to warn about
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  const profileId = await findProfileId(undefined, customerId)
  if (!profileId) {
    console.error('invoice.upcoming: could not resolve profile for customer', customerId)
    return
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, tier, billing_interval')
    .eq('id', profileId)
    .maybeSingle()
  if (!profile?.email) return
  // Monthly plans renew every few weeks — skip those; Stripe's receipt suffices.
  if (!profile.billing_interval || profile.billing_interval === 'month') return

  const name = escapeHtml((profile.full_name || '').trim() || 'there')
  const amount = `$${((invoice.amount_due ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const renewTs = invoice.next_payment_attempt ?? invoice.period_end
  const renewDate = renewTs
    ? new Date(renewTs * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'soon'
  const termLabel = profile.billing_interval === 'two_year_prepay' ? '2-year' : 'annual'
  const manageUrl = `${APP_URL}/dashboard?view=settings`

  try {
    await resend.emails.send({
      from: 'ohACCESS <noreply@mail.ohaccess.com>',
      to: profile.email,
      replyTo: 'support@ohaccess.com',
      subject: `Your ohACCESS plan renews on ${renewDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 20px;">
          <div style="background: #1d1d1f; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
            <div style="font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
          </div>
          <div style="background: white; border-radius: 0 0 16px 16px; padding: 24px; color: #1d1d1f; font-size: 14px; line-height: 1.6;">
            <p>Hi ${name},</p>
            <p>A quick heads-up: your ohACCESS ${escapeHtml(termLabel)} plan renews on <strong>${escapeHtml(renewDate)}</strong>, and your card on file will be charged <strong>${escapeHtml(amount)}</strong>.</p>
            <p>No action is needed if you'd like to continue — everything keeps working without interruption.</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${manageUrl}" style="background: #1d1d1f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700;">Manage subscription</a>
            </p>
            <p style="font-size: 13px; color: #6e6e73;">You can cancel or change your plan anytime before the renewal date from your dashboard settings. Questions? Just reply to this email.</p>
          </div>
        </div>
      `,
    })
  } catch (e) {
    console.error('invoice.upcoming: renewal notice email failed', e)
  }
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
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      case 'invoice.upcoming':
        await handleInvoiceUpcoming(event.data.object as Stripe.Invoice)
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
