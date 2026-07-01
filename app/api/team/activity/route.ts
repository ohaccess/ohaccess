import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { getBrokerageContext } from '@/lib/team'

// GET: brokerage-wide activity rollup for the team lead — every agent's open
// houses and visitor counts across the whole brokerage in one round-trip.
// Admin only. Visitor *details* are loaded per open house via
// /api/team/activity/[id]/visitors so we never dump every visitor at once.
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getBrokerageContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No team found' }, { status: 404 })
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'Only the team lead can view team activity' }, { status: 403 })
  }

  // Everyone on the team. Used both as the agent roster and to resolve
  // agent_id → display name on each open house.
  const { data: members } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('brokerage_id', ctx.brokerageId)
  const agentIds = (members ?? []).map(m => m.id)
  const nameById = new Map(
    (members ?? []).map(m => [m.id, m.full_name || m.email || 'Agent'])
  )

  if (agentIds.length === 0) {
    return NextResponse.json({
      agents: [],
      openHouses: [],
      totals: { agents: 0, openHouses: 0, visitors: 0, verified: 0 },
    })
  }

  // All open houses + a lightweight slice of every visitor (just the columns we
  // need to roll up counts). Full visitor rows are fetched lazily per OH.
  const [{ data: openHouses }, { data: visitors }] = await Promise.all([
    supabase
      .from('open_houses')
      .select('id, agent_id, property_address, open_house_date, open_house_hours, status, created_at')
      .in('agent_id', agentIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('visitors')
      .select('open_house_id, agent_id, verified')
      .in('agent_id', agentIds),
  ])

  // Roll visitor counts up by open house and by agent.
  const ohVisitors = new Map<string, { total: number; verified: number }>()
  const agentVisitors = new Map<string, { total: number; verified: number }>()
  for (const v of visitors ?? []) {
    const oh = ohVisitors.get(v.open_house_id) || { total: 0, verified: 0 }
    oh.total++
    if (v.verified) oh.verified++
    ohVisitors.set(v.open_house_id, oh)

    const ag = agentVisitors.get(v.agent_id) || { total: 0, verified: 0 }
    ag.total++
    if (v.verified) ag.verified++
    agentVisitors.set(v.agent_id, ag)
  }

  const ohCountByAgent = new Map<string, number>()
  const openHousesOut = (openHouses ?? []).map(oh => {
    ohCountByAgent.set(oh.agent_id, (ohCountByAgent.get(oh.agent_id) || 0) + 1)
    const counts = ohVisitors.get(oh.id) || { total: 0, verified: 0 }
    return {
      id: oh.id,
      agent_id: oh.agent_id,
      agent_name: nameById.get(oh.agent_id) || 'Agent',
      property_address: oh.property_address,
      open_house_date: oh.open_house_date,
      open_house_hours: oh.open_house_hours,
      status: oh.status,
      visitor_count: counts.total,
      verified_count: counts.verified,
    }
  })

  const agentsOut = (members ?? [])
    .map(m => {
      const v = agentVisitors.get(m.id) || { total: 0, verified: 0 }
      return {
        id: m.id,
        full_name: m.full_name,
        email: m.email,
        open_house_count: ohCountByAgent.get(m.id) || 0,
        visitor_count: v.total,
        verified_count: v.verified,
      }
    })
    .sort((a, b) => b.visitor_count - a.visitor_count)

  return NextResponse.json({
    agents: agentsOut,
    openHouses: openHousesOut,
    totals: {
      agents: agentIds.length,
      openHouses: openHousesOut.length,
      visitors: (visitors ?? []).length,
      verified: (visitors ?? []).filter(v => v.verified).length,
    },
  })
}
