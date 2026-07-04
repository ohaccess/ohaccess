import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'
import { ensureManagedBrokerage, getSeatUsage } from '@/lib/team'

// Admin-only provisioning for INVOICE-BASED custom deals (100+ agents, or any
// negotiated arrangement outside self-serve Stripe billing). Creates/adopts a
// brokerage for an existing account and makes them the brokerage admin —
// replacing the old hand-editing in Supabase Studio.
//
// Deliberately leaves the owner's Stripe columns null: that null subscription
// id is exactly what makes the self-serve seat routes respond "billing is
// handled by your account manager", and it keeps the webhook from ever
// touching a provisioned brokerage. Payment happens via Stripe invoices that
// Dave sends from the Stripe dashboard.
//
//   POST  { ownerEmail, seatLimit, name?, accessUntil? } — provision
//   PATCH { brokerageId, seatLimit }                     — adjust seats

export async function POST(request: Request) {
  const admin = await getAuthenticatedUser(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(admin.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const ownerEmail = typeof body?.ownerEmail === 'string' ? body.ownerEmail.trim().toLowerCase() : ''
  const seatLimit = Number(body?.seatLimit)
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : null
  const accessUntil = typeof body?.accessUntil === 'string' && body.accessUntil ? body.accessUntil : null

  if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return NextResponse.json({ error: 'Valid owner email required' }, { status: 400 })
  }
  // No self-serve 100-cap here — this path exists precisely for the big deals.
  if (!Number.isInteger(seatLimit) || seatLimit < 1 || seatLimit > 100_000) {
    return NextResponse.json({ error: 'Seat limit must be a whole number (1–100,000)' }, { status: 400 })
  }
  if (accessUntil && Number.isNaN(Date.parse(accessUntil))) {
    return NextResponse.json({ error: 'accessUntil must be a valid date' }, { status: 400 })
  }

  const { data: owner } = await supabase
    .from('profiles')
    .select('id, email, tier, brokerage_id, role')
    .ilike('email', ownerEmail)
    .maybeSingle()
  if (!owner) {
    return NextResponse.json(
      { error: `No account found for ${ownerEmail}. They need to sign up at ohaccess.com first.` },
      { status: 404 }
    )
  }
  // Don't silently hijack someone who's a MEMBER of another team.
  if (owner.brokerage_id && owner.role !== 'brokerage_admin') {
    return NextResponse.json(
      { error: 'That account is a member of another team. Remove them from it first.' },
      { status: 409 }
    )
  }

  const brokerageId = await ensureManagedBrokerage(owner.id, {
    tier: 'brokerage',
    seatLimit,
    name,
  })
  if (!brokerageId) {
    return NextResponse.json({ error: 'Could not create the brokerage' }, { status: 500 })
  }

  // Comped/invoice-based: mark the account active at the brokerage tier with
  // NO Stripe wiring. accessUntil (optional) documents the agreed term.
  await supabase
    .from('profiles')
    .update({
      tier: 'brokerage',
      subscription_status: 'active',
      billing_interval: null,
      current_period_end: accessUntil,
    })
    .eq('id', owner.id)

  console.log(`[admin] ${admin.email} provisioned brokerage ${brokerageId} for ${ownerEmail} (${seatLimit} seats${accessUntil ? `, until ${accessUntil}` : ''})`)
  return NextResponse.json({ success: true, brokerageId, seatLimit })
}

export async function PATCH(request: Request) {
  const admin = await getAuthenticatedUser(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(admin.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const brokerageId = typeof body?.brokerageId === 'string' ? body.brokerageId : ''
  const seatLimit = Number(body?.seatLimit)

  if (!brokerageId) return NextResponse.json({ error: 'brokerageId required' }, { status: 400 })
  if (!Number.isInteger(seatLimit) || seatLimit < 1 || seatLimit > 100_000) {
    return NextResponse.json({ error: 'Seat limit must be a whole number (1–100,000)' }, { status: 400 })
  }

  const usage = await getSeatUsage(brokerageId)
  if (seatLimit < usage.used) {
    return NextResponse.json(
      { error: `That team is using ${usage.used} seats (members + pending invites) — can't set the limit below that.` },
      { status: 409 }
    )
  }

  const { error } = await supabase.from('brokerages').update({ seat_limit: seatLimit }).eq('id', brokerageId)
  if (error) {
    console.error('Admin seat-limit update failed', error)
    return NextResponse.json({ error: 'Could not update the seat limit' }, { status: 500 })
  }

  console.log(`[admin] ${admin.email} set brokerage ${brokerageId} seat_limit to ${seatLimit}`)
  return NextResponse.json({ success: true, brokerageId, seatLimit })
}
