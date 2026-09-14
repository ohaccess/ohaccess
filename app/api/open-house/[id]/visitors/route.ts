import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { registrationClosed } from '@/lib/trial-cap'
import { inferProfileCountry, normalizeCountry } from '@/lib/regions'
import { validateManualVisitor, MANUAL_VISITOR_SOURCE } from '@/lib/manual-visitor'

// POST: the agent adds a visitor by hand (dashboard "+ Add visitor"), for
// someone who couldn't sign in with the QR code. Owner-only. The row is saved
// with source 'manual' and nothing is sent to anyone: no codeword, no agent
// alert, no CRM push, and the thank-you and invite senders skip these rows
// (see lib/manual-visitor.ts for why).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await checkRateLimit(`agent:${user.id}`, 'manual-visitor', 60, 3600)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'You’ve added a lot of visitors in the last hour. Please try again later.' }, { status: 429 })
  }

  const { id } = await params
  const { data: openHouse } = await supabase
    .from('open_houses')
    .select('id, agent_id, start_at, end_at, country')
    .eq('id', id)
    .maybeSingle()
  if (!openHouse || openHouse.agent_id !== user.id) {
    return NextResponse.json({ error: 'Open house not found' }, { status: 404 })
  }

  const { data: agent } = await supabase
    .from('profiles')
    .select('id, tier, sponsor_id, bonus_visitors, billing_interval, stripe_subscription_id, current_period_end, country, state, phone')
    .eq('id', user.id)
    .maybeSingle()

  // Same free-trial rule as a QR sign-in (lib/trial-cap.ts), so typing
  // visitors in can't be used to keep collecting past the cap.
  if (await registrationClosed(supabase, openHouse, agent)) {
    return NextResponse.json(
      { error: 'You’ve used all your free visitor registrations. Upgrade to keep adding visitors.' },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => null)
  const defaultCountry = normalizeCountry(openHouse.country) ?? inferProfileCountry(agent)
  const checked = validateManualVisitor(body, defaultCountry)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })

  const { data: visitor, error } = await supabase
    .from('visitors')
    .insert({
      open_house_id: openHouse.id,
      agent_id: user.id,
      ...checked.fields,
      source: MANUAL_VISITOR_SOURCE,
      sms_opted_out: false,
    })
    .select('*')
    .single()
  if (error || !visitor) {
    console.error('Manual visitor insert failed', error)
    return NextResponse.json({ error: 'Could not add the visitor. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ visitor })
}
