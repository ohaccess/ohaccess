import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { normalizeGiftCode, giftAccessEnd } from '@/lib/gift'

// POST { code }: redeem a 1-year Pro gift onto the signed-in agent's account.
// Two application paths, per Dave's design (gifts always ADD 12 months):
//
//   No live Stripe subscription (free / trial / comped / expired prepaid) —
//   reuse the admin-comp shape (billing_interval='comped', migration 021
//   notes): Pro until max(now, current access end) + 1 year. The webhook
//   never touches comped rows, so nothing fights.
//
//   Live Stripe subscription (active/trialing/past_due) — push the next
//   invoice out 12 months at Stripe itself by extending trial_end to
//   current_period_end + 1 year (proration off). Stripe flips the sub to
//   'trialing' (a live status everywhere in this codebase) and the
//   subscription.updated webhook syncs current_period_end; we also stamp it
//   locally so the dashboard is right immediately.
//
// Brokerage-linked accounts (members AND owners) are refused without
// consuming the code: a member's access is company-paid, and an owner's
// subscription funds the whole team — a $150 gift must not extend a
// whole-team plan. Concierge those through support instead.
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Codes are unguessable (30^8) only as long as guessing is expensive.
    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'gift-claim', 20, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many attempts — try again later' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const code = normalizeGiftCode(body?.code)
    if (!code) {
      return NextResponse.json(
        { error: "That doesn't look like a gift code — it should read like GIFT-XXXX-XXXX." },
        { status: 400 }
      )
    }

    const { data: gift } = await supabase
      .from('gift_purchases')
      .select('id, code, months, giver_name, gift_note, claimed_by, claimed_at')
      .eq('code', code)
      .maybeSingle()
    if (!gift) {
      return NextResponse.json(
        { error: "We couldn't find that gift code. Double-check it against the gift email, or contact support@ohaccess.com." },
        { status: 404 }
      )
    }
    if (gift.claimed_by) {
      if (gift.claimed_by === user.id) {
        // Re-submitting your own claim (double-click, refresh) isn't an error.
        return NextResponse.json({
          success: true,
          alreadyClaimed: true,
          giverName: gift.giver_name,
          note: gift.gift_note,
        })
      }
      return NextResponse.json(
        { error: 'This gift code has already been claimed. If you think that\'s a mistake, contact support@ohaccess.com.' },
        { status: 409 }
      )
    }

    // The claim page can be the very first thing a brand-new signup hits
    // (before the dashboard's auto-create runs), so create the profile here
    // the same way the dashboard does — including the referral stamp.
    let { data: profile } = await supabase
      .from('profiles')
      .select('id, tier, role, brokerage_id, stripe_subscription_id, subscription_status, current_period_end')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile) {
      const metaRef = (user.user_metadata?.referral_source as string | undefined) || null
      const cookieHeader = request.headers.get('cookie') || ''
      const refCookie = cookieHeader.split('; ').find((c) => c.startsWith('ohaccess_ref='))
      const cookieRef = refCookie ? decodeURIComponent(refCookie.split('=')[1] || '') : null
      const referralSource = metaRef || cookieRef
      const insertRow: Record<string, unknown> = { id: user.id, email: user.email }
      if (referralSource) {
        insertRow.referral_source = referralSource
        insertRow.referral_source_first_seen_at = new Date().toISOString()
      }
      const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert(insertRow)
        .select('id, tier, role, brokerage_id, stripe_subscription_id, subscription_status, current_period_end')
        .single()
      if (createError || !created) {
        console.error('Gift claim: profile create failed', createError)
        return NextResponse.json({ error: 'Could not set up your account — try again' }, { status: 500 })
      }
      profile = created
    }

    if (profile.brokerage_id) {
      return NextResponse.json(
        { error: "Your access is covered by your team's plan, so the gift can't apply here automatically. Email support@ohaccess.com with your gift code and we'll sort it out." },
        { status: 409 }
      )
    }

    const activeStatuses = ['active', 'trialing', 'past_due']
    const hasLiveSub =
      !!profile.stripe_subscription_id && activeStatuses.includes(profile.subscription_status ?? '')

    // Consume the code FIRST, atomically (only if still unclaimed), so two
    // simultaneous claims can't both apply. If applying fails afterwards we
    // release it again in the catch below.
    const { data: consumed } = await supabase
      .from('gift_purchases')
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq('id', gift.id)
      .is('claimed_by', null)
      .select('id')
    if (!consumed?.length) {
      return NextResponse.json(
        { error: 'This gift code has already been claimed. If you think that\'s a mistake, contact support@ohaccess.com.' },
        { status: 409 }
      )
    }

    try {
      let accessUntil: Date

      if (hasLiveSub) {
        const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id!)
        const itemEnd = sub.items.data[0]?.current_period_end
        accessUntil = giftAccessEnd(itemEnd ? new Date(itemEnd * 1000).toISOString() : null)
        await stripe.subscriptions.update(sub.id, {
          trial_end: Math.floor(accessUntil.getTime() / 1000),
          proration_behavior: 'none',
        })
        // The subscription.updated webhook will sync too; stamping locally
        // makes the dashboard right the instant the claim returns.
        await supabase
          .from('profiles')
          .update({ current_period_end: accessUntil.toISOString() })
          .eq('id', user.id)
      } else {
        accessUntil = giftAccessEnd(profile.current_period_end)
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            tier: 'pro',
            subscription_status: 'active',
            billing_interval: 'comped',
            current_period_end: accessUntil.toISOString(),
            subscription_canceled_at: null,
          })
          .eq('id', user.id)
        if (updateError) throw updateError
      }

      console.log(`[gift] ${user.email} claimed ${code} — Pro until ${accessUntil.toISOString()}`)
      return NextResponse.json({
        success: true,
        accessUntil: accessUntil.toISOString(),
        giverName: gift.giver_name,
        note: gift.gift_note,
      })
    } catch (applyError) {
      // Release the code so the recipient can try again — better a retryable
      // claim than a consumed code with no year attached.
      await supabase
        .from('gift_purchases')
        .update({ claimed_by: null, claimed_at: null })
        .eq('id', gift.id)
        .eq('claimed_by', user.id)
      console.error('Gift claim: apply failed, code released', applyError)
      return NextResponse.json({ error: 'Something went wrong applying your gift — please try again' }, { status: 500 })
    }
  } catch (error) {
    console.error('Gift claim error:', error)
    return NextResponse.json({ error: 'Failed to claim gift' }, { status: 500 })
  }
}
