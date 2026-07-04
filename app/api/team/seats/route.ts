import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getBrokerageContext, getSeatUsage, type BrokerageContext } from '@/lib/team'
import { stripe, type BillingInterval } from '@/lib/stripe'
import { isValidSeatCount, perSeatCents, totalCents, MIN_BROKERAGE_SEATS, MAX_BROKERAGE_SEATS } from '@/lib/billing-plans'
import { escapeHtml } from '@/lib/escape-html'

const resend = new Resend(process.env.RESEND_API_KEY!)

// Self-serve seat management for per-seat Brokerage plans (11–100 agents).
//   GET  ?quantity=N  -> proration preview: what Stripe will charge RIGHT NOW
//   POST { quantity } -> apply the change
//
// Increases charge the term-prorated difference immediately
// (proration_behavior 'always_invoice') and abort atomically on a declined
// card (payment_behavior 'error_if_incomplete') — a seat can never appear
// added-but-unpaid. Decreases issue no refund or credit (terms §4.7,
// proration_behavior 'none'); the lower rate simply applies from the next
// invoice, and we email the admin a confirmation saying exactly that.
// Stripe's own proration line items carry self-explanatory descriptions
// ("Remaining time on N × Brokerage…"), so receipts read clearly.

// The funding subscription lives on the brokerage row (recorded by the
// webhook); fall back to the owner's profile for the window right after
// checkout before the first subscription event lands. Null for
// admin-provisioned (invoice-based) brokerages — those are managed by us.
async function resolveSubId(ctx: BrokerageContext): Promise<string | null> {
  if (ctx.stripeSubscriptionId) return ctx.stripeSubscriptionId
  const { data: owner } = await supabase
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', ctx.ownerId)
    .maybeSingle()
  return owner?.stripe_subscription_id ?? null
}

// Map the Stripe price's recurrence back to our interval key.
function intervalFromRecurring(rec: { interval: string; interval_count: number } | null | undefined): BillingInterval {
  if (!rec || rec.interval === 'month') return 'month'
  return rec.interval_count === 2 ? 'two_year_prepay' : 'year'
}

type Guarded =
  | { ok: true; ctx: BrokerageContext; subId: string }
  | { ok: false; res: NextResponse }

async function guard(request: Request): Promise<Guarded> {
  const user = await getAuthenticatedUser(request)
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const ctx = await getBrokerageContext(user.id)
  if (!ctx) return { ok: false, res: NextResponse.json({ error: 'No team found' }, { status: 404 }) }
  if (!ctx.isAdmin) {
    return { ok: false, res: NextResponse.json({ error: 'Only the team lead can change seats' }, { status: 403 }) }
  }
  if (ctx.tier !== 'brokerage') {
    return { ok: false, res: NextResponse.json({ error: 'Seat management is for per-seat Brokerage plans. Upgrade your Team plan first.' }, { status: 409 }) }
  }
  const subId = await resolveSubId(ctx)
  if (!subId) {
    return { ok: false, res: NextResponse.json({ error: 'Your plan is invoice-based — seats are handled by your account manager. Email support@ohaccess.com to adjust.' }, { status: 409 }) }
  }
  return { ok: true, ctx, subId }
}

export async function GET(request: Request) {
  try {
    const g = await guard(request)
    if (!g.ok) return g.res

    const url = new URL(request.url)
    const quantity = Number(url.searchParams.get('quantity'))
    if (!isValidSeatCount(quantity)) {
      return NextResponse.json(
        { error: `Seat count must be ${MIN_BROKERAGE_SEATS}–${MAX_BROKERAGE_SEATS}. Need more? Contact us.` },
        { status: 400 }
      )
    }

    const sub = await stripe.subscriptions.retrieve(g.subId)
    const item = sub.items.data[0]
    if (!item) return NextResponse.json({ error: 'Subscription has no items' }, { status: 500 })
    const interval = intervalFromRecurring(item.price.recurring)

    // What would Stripe charge right now for this quantity change?
    const preview = await stripe.invoices.createPreview({
      customer: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      subscription: g.subId,
      subscription_details: {
        items: [{ id: item.id, quantity }],
        proration_behavior: 'always_invoice',
      },
    })

    return NextResponse.json({
      currentQuantity: item.quantity ?? 0,
      quantity,
      // Amount due immediately for the change (0 when decreasing — no credits).
      amountDueNowCents: Math.max(preview.amount_due ?? 0, 0),
      currency: preview.currency ?? 'usd',
      perSeatCents: perSeatCents(interval),
      newTotalCents: totalCents(quantity, interval),
      interval,
    })
  } catch (error) {
    console.error('Seat preview error:', error)
    return NextResponse.json({ error: 'Could not preview the seat change' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'team-seats', 30, 3600)
    if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const g = await guard(request)
    if (!g.ok) return g.res

    const body = await request.json().catch(() => ({}))
    const quantity = Number(body?.quantity)
    if (!isValidSeatCount(quantity)) {
      return NextResponse.json(
        { error: `Seat count must be ${MIN_BROKERAGE_SEATS}–${MAX_BROKERAGE_SEATS}. Need more? Contact us.` },
        { status: 400 }
      )
    }

    // Never allow the limit below what's already occupied (members + pending
    // invites) — remove people first, then shrink.
    const usage = await getSeatUsage(g.ctx.brokerageId)
    if (quantity < usage.used) {
      return NextResponse.json(
        { error: `You're currently using ${usage.used} seats (members + pending invites). Remove members or invites before reducing below that.` },
        { status: 409 }
      )
    }

    const sub = await stripe.subscriptions.retrieve(g.subId)
    const item = sub.items.data[0]
    if (!item) return NextResponse.json({ error: 'Subscription has no items' }, { status: 500 })
    const currentQty = item.quantity ?? 0
    if (quantity === currentQty) {
      return NextResponse.json({ success: true, unchanged: true, quantity })
    }
    const isIncrease = quantity > currentQty
    const interval = intervalFromRecurring(item.price.recurring)

    await stripe.subscriptions.update(g.subId, {
      items: [{ id: item.id, quantity }],
      // Increases: charge the prorated difference immediately. Decreases: no
      // refund/credit (terms §4.7) — the lower rate applies from next invoice.
      proration_behavior: isIncrease ? 'always_invoice' : 'none',
      // Declined card -> the whole update fails and nothing changes; the admin
      // sees the error instead of the subscription drifting into past_due.
      payment_behavior: 'error_if_incomplete',
      metadata: { ...sub.metadata, seats: String(quantity) },
    })

    // Optimistic; the customer.subscription.updated webhook re-confirms from
    // the authoritative subscription state.
    await supabase.from('brokerages').update({ seat_limit: quantity }).eq('id', g.ctx.brokerageId)

    // On a decrease, confirm in writing what changed and when it takes effect
    // (adopted from the outside spec review — good customer hygiene).
    if (!isIncrease) {
      const { data: owner } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', g.ctx.ownerId)
        .maybeSingle()
      if (owner?.email) {
        const nextInvoice = item.current_period_end
          ? new Date(item.current_period_end * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'your next invoice'
        try {
          await resend.emails.send({
            from: 'ohACCESS <noreply@mail.ohaccess.com>',
            to: owner.email,
            replyTo: 'support@ohaccess.com',
            subject: `Your ohACCESS plan is now ${quantity} seats`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 20px;">
                <div style="background: #1d1d1f; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
                  <div style="font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
                </div>
                <div style="background: white; border-radius: 0 0 16px 16px; padding: 24px; color: #1d1d1f; font-size: 14px; line-height: 1.6;">
                  <p>Hi ${escapeHtml((owner.full_name || '').trim() || 'there')},</p>
                  <p>Confirming your seat change: your plan went from <strong>${currentQty}</strong> to <strong>${quantity}</strong> seats.</p>
                  <p>Per our terms, reductions don't generate refunds or credits for the current billing period — the lower rate of <strong>$${(totalCents(quantity, interval) / 100).toLocaleString('en-US')}</strong> takes effect on ${escapeHtml(nextInvoice)}.</p>
                  <p style="font-size: 13px; color: #6e6e73;">Questions? Just reply to this email.</p>
                </div>
              </div>
            `,
          })
        } catch (e) {
          console.error('Seat-decrease confirmation email failed', e)
        }
      }
    }

    return NextResponse.json({
      success: true,
      quantity,
      previousQuantity: currentQty,
      newTotalCents: totalCents(quantity, interval),
    })
  } catch (error) {
    // Stripe card errors surface with a helpful message (e.g. declined).
    const message = error instanceof Error ? error.message : 'Could not update seats'
    const isCardError = typeof error === 'object' && error !== null && (error as { type?: string }).type === 'StripeCardError'
    console.error('Seat update error:', error)
    return NextResponse.json(
      { error: isCardError ? `Payment failed: ${message} Your seat count was not changed.` : message },
      { status: isCardError ? 402 : 500 }
    )
  }
}
