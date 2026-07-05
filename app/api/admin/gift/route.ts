import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'
import { TRIAL_LIMIT } from '@/lib/billing-plans'

// Admin-only gifts — the manual reward mechanism behind the referral program.
//
//   POST { userId, action: 'visitors', amount }  — add bonus trial visitors
//                                                  (negative amount corrects a
//                                                  mistake; floor is 0)
//   POST { userId, action: 'comp', until }       — free Pro until a date, for
//                                                  agents WITHOUT a Stripe sub
//
// A comp reuses the legacy-prepay shape: paid tier + status active +
// billing_interval='comped' + current_period_end=until, NO Stripe ids. Every
// existing guard (dashboard renewal prompt, register trial cap, checkout)
// treats it as free once the date passes, and the webhook never touches it.
// Gifts to agents who already PAY happen in the Stripe dashboard (credit /
// coupon), never here — this route refuses, so app state and Stripe state
// can't diverge.

export async function POST(request: Request) {
  const admin = await getAuthenticatedUser(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(admin.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  const action = typeof body?.action === 'string' ? body.action : ''

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, tier, role, brokerage_id, bonus_visitors, subscription_status, stripe_subscription_id, billing_interval, current_period_end')
    .eq('id', userId)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: 'No account found' }, { status: 404 })

  const name = profile.full_name || profile.email

  if (action === 'visitors') {
    const amount = Number(body?.amount)
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10_000) {
      return NextResponse.json({ error: 'Amount must be a whole number (e.g. 25; negative to remove)' }, { status: 400 })
    }
    const newBonus = Math.max(0, (profile.bonus_visitors || 0) + amount)
    const { error } = await supabase.from('profiles').update({ bonus_visitors: newBonus }).eq('id', userId)
    if (error) {
      console.error('Bonus visitors update failed', error)
      return NextResponse.json({ error: 'Could not update bonus visitors' }, { status: 500 })
    }
    console.log(`[admin] ${admin.email} gifted ${amount} bonus visitors to ${profile.email} (now ${newBonus})`)
    return NextResponse.json({
      success: true,
      name,
      bonusVisitors: newBonus,
      trialLimit: TRIAL_LIMIT + newBonus,
    })
  }

  if (action === 'comp') {
    const until = typeof body?.until === 'string' ? body.until : ''
    const untilMs = Date.parse(until)
    if (Number.isNaN(untilMs)) {
      return NextResponse.json({ error: 'until must be a valid date (YYYY-MM-DD)' }, { status: 400 })
    }
    if (untilMs < Date.now()) {
      return NextResponse.json({ error: 'That date is in the past' }, { status: 400 })
    }
    // Already paying at Stripe? Gift them there (credit/coupon on their
    // customer), not here — overwriting their row would fight the webhook.
    const activeStatuses = ['active', 'trialing', 'past_due']
    if (profile.stripe_subscription_id && activeStatuses.includes(profile.subscription_status ?? '')) {
      return NextResponse.json(
        { error: 'This agent has an active Stripe subscription. Gift them a credit from the Stripe dashboard instead.' },
        { status: 409 }
      )
    }
    // Team members are already covered by their team's plan; comping them
    // would set personal billing fields the team webhook logic owns.
    if (profile.brokerage_id && profile.role !== 'brokerage_admin') {
      return NextResponse.json(
        { error: 'This agent is on a team plan — they already have full access.' },
        { status: 409 }
      )
    }

    // End the gift at the END of that day (23:59:59 UTC) so "until July 31"
    // includes July 31.
    const end = new Date(untilMs)
    end.setUTCHours(23, 59, 59, 999)

    const { error } = await supabase
      .from('profiles')
      .update({
        tier: 'pro',
        subscription_status: 'active',
        billing_interval: 'comped',
        current_period_end: end.toISOString(),
        subscription_canceled_at: null,
      })
      .eq('id', userId)
    if (error) {
      console.error('Comp update failed', error)
      return NextResponse.json({ error: 'Could not gift access' }, { status: 500 })
    }
    console.log(`[admin] ${admin.email} comped Pro for ${profile.email} until ${end.toISOString()}`)
    return NextResponse.json({ success: true, name, until: end.toISOString() })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
