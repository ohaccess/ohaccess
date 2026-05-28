import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { getBrokerageContext, getSeatUsage } from '@/lib/team'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

// GET: everything the team-admin panel needs in one round-trip —
// brokerage settings, members, pending invites, seat usage.
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getBrokerageContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No team found' }, { status: 404 })

  const [{ data: members }, { data: invitations }, usage] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .eq('brokerage_id', ctx.brokerageId)
      .order('created_at', { ascending: true }),
    supabase
      .from('brokerage_invitations')
      .select('id, email, role, expires_at, accepted_at, created_at')
      .eq('brokerage_id', ctx.brokerageId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
    getSeatUsage(ctx.brokerageId),
  ])

  return NextResponse.json({
    brokerage: {
      id: ctx.brokerageId,
      name: ctx.name,
      tier: ctx.tier,
      logo_url: ctx.logoUrl,
      primary_color: ctx.primaryColor,
      accent_color: ctx.accentColor,
      owner_id: ctx.ownerId,
    },
    isAdmin: ctx.isAdmin,
    members: members ?? [],
    invitations: invitations ?? [],
    seats: usage,
  })
}

// PATCH: update brokerage name + brand colors. Admin only.
export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getBrokerageContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No team found' }, { status: 404 })
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'Only the team lead can change team settings' }, { status: 403 })
  }

  const body = await request.json()
  const update: Record<string, string> = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (name.length < 1 || name.length > 100) {
      return NextResponse.json({ error: 'Team name must be 1–100 characters' }, { status: 400 })
    }
    update.name = name
  }
  if (body.primary_color !== undefined) {
    if (!isHexColor(body.primary_color)) {
      return NextResponse.json({ error: 'Primary color must be a hex value like #1d1d1f' }, { status: 400 })
    }
    update.primary_color = body.primary_color
  }
  if (body.accent_color !== undefined) {
    if (!isHexColor(body.accent_color)) {
      return NextResponse.json({ error: 'Accent color must be a hex value like #0071e3' }, { status: 400 })
    }
    update.accent_color = body.accent_color
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabase.from('brokerages').update(update).eq('id', ctx.brokerageId)
  if (error) {
    console.error('Brokerage settings update failed', error)
    return NextResponse.json({ error: 'Could not save team settings' }, { status: 500 })
  }

  // Mirror the team's colors onto every member's profile so public surfaces
  // (the visitor registration page, dashboard chrome) reflect team branding.
  // The brokerages table isn't readable by the anonymous registration page,
  // but profiles already are — so we denormalize.
  const colorMirror: Record<string, string> = {}
  if (update.primary_color) colorMirror.primary_color = update.primary_color
  if (update.accent_color) colorMirror.accent_color = update.accent_color
  if (Object.keys(colorMirror).length > 0) {
    await supabase.from('profiles').update(colorMirror).eq('brokerage_id', ctx.brokerageId)
  }

  return NextResponse.json({ success: true })
}
