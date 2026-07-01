import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { getBrokerageContext } from '@/lib/team'

// GET: full visitor log for one open house, for the team lead. Admin only, and
// only if the open house belongs to an agent on the admin's own brokerage —
// so a team lead can never read another brokerage's visitors.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getBrokerageContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No team found' }, { status: 404 })
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'Only the team lead can view team activity' }, { status: 403 })
  }

  const { id } = await params

  // Confirm this open house belongs to an agent on this brokerage.
  const { data: oh } = await supabase
    .from('open_houses')
    .select('id, agent_id, property_address')
    .eq('id', id)
    .maybeSingle()
  if (!oh) {
    return NextResponse.json({ error: 'Open house not found' }, { status: 404 })
  }

  const { data: agent } = await supabase
    .from('profiles')
    .select('id, brokerage_id')
    .eq('id', oh.agent_id)
    .maybeSingle()
  if (!agent || agent.brokerage_id !== ctx.brokerageId) {
    return NextResponse.json({ error: 'That open house is not on your team' }, { status: 404 })
  }

  const { data: visitors } = await supabase
    .from('visitors')
    .select('id, first_name, last_name, email, phone, purchasing_timeline, registered_at, verified')
    .eq('open_house_id', id)
    .order('registered_at', { ascending: false })

  return NextResponse.json({
    open_house: { id: oh.id, property_address: oh.property_address },
    visitors: visitors ?? [],
  })
}
