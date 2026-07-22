import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'

// GET: the sponsor's activity view — mirrors /api/team/activity, with one
// deliberate privacy boundary: the ONLY visitor rows returned are those
// stamped with this sponsor's id at sign-in, i.e. visitors whose consent
// language explicitly named this sponsor. Sign-ins from before the
// sponsorship (or after it ends) are invisible to the sponsor by design.
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!sponsor) return NextResponse.json({ error: 'No sponsor profile found' }, { status: 404 })

  // Sponsored agents (accepted invites only — that's what sets sponsor_id).
  const { data: agents } = await supabase
    .from('profiles')
    .select('id, full_name, email, brokerage')
    .eq('sponsor_id', sponsor.id)
  const agentIds = (agents ?? []).map(a => a.id)
  const agentName = new Map((agents ?? []).map(a => [a.id, a.full_name || a.email || 'Agent']))

  // Consent-named sign-ins, newest first. Capped generously; the dashboard
  // is a recent-activity view, not a full export tool.
  const { data: visitors } = await supabase
    .from('visitors')
    .select('id, open_house_id, agent_id, first_name, last_name, email, phone, purchasing_timeline, registered_at, verified')
    .eq('sponsor_id', sponsor.id)
    .order('registered_at', { ascending: false })
    .limit(500)
  const sponsoredVisitors = visitors ?? []

  // Open houses of sponsored agents (schedule info; counts below are
  // sponsored sign-ins only, so pre-sponsorship events just show 0).
  let openHouses: {
    id: string
    agent_id: string
    agent_name: string
    property_address: string
    open_house_date: string | null
    open_house_hours: string | null
    status: string
    visitor_count: number
    verified_count: number
  }[] = []
  if (agentIds.length > 0) {
    const { data: ohRows } = await supabase
      .from('open_houses')
      .select('id, agent_id, property_address, open_house_date, open_house_hours, status, created_at')
      .in('agent_id', agentIds)
      .order('created_at', { ascending: false })
      .limit(100)
    const counts = new Map<string, { total: number; verified: number }>()
    for (const v of sponsoredVisitors) {
      const c = counts.get(v.open_house_id) ?? { total: 0, verified: 0 }
      c.total++
      if (v.verified) c.verified++
      counts.set(v.open_house_id, c)
    }
    openHouses = (ohRows ?? []).map(oh => ({
      id: oh.id,
      agent_id: oh.agent_id,
      agent_name: agentName.get(oh.agent_id) ?? 'Agent',
      property_address: oh.property_address,
      open_house_date: oh.open_house_date,
      open_house_hours: oh.open_house_hours,
      status: oh.status,
      visitor_count: counts.get(oh.id)?.total ?? 0,
      verified_count: counts.get(oh.id)?.verified ?? 0,
    }))
  }

  // Per-agent rollup (sponsored sign-ins only).
  const perAgent = new Map<string, { open_house_count: number; visitor_count: number; verified_count: number }>()
  for (const id of agentIds) perAgent.set(id, { open_house_count: 0, visitor_count: 0, verified_count: 0 })
  for (const oh of openHouses) {
    const r = perAgent.get(oh.agent_id)
    if (r) r.open_house_count++
  }
  for (const v of sponsoredVisitors) {
    const r = perAgent.get(v.agent_id)
    if (r) { r.visitor_count++; if (v.verified) r.verified_count++ }
  }

  return NextResponse.json({
    agents: (agents ?? []).map(a => ({
      id: a.id,
      full_name: a.full_name,
      email: a.email,
      brokerage: a.brokerage,
      ...(perAgent.get(a.id) ?? { open_house_count: 0, visitor_count: 0, verified_count: 0 }),
    })),
    openHouses,
    visitors: sponsoredVisitors,
    totals: {
      agents: agentIds.length,
      openHouses: openHouses.length,
      visitors: sponsoredVisitors.length,
      verified: sponsoredVisitors.filter(v => v.verified).length,
    },
  })
}
