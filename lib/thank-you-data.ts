import type { SupabaseClient } from '@supabase/supabase-js'
import { type UpcomingOpenHouse } from './register-helpers'
import { formatArea } from './regions'

// Data assembly shared by the next-morning thank-you cron and the dashboard's
// "✉️ Visitor email" preview, so what the agent previews is built exactly the
// way the real email is.

type Row = Record<string, string | null | undefined>

// Moved to the shared email shell; re-exported for existing imports.
export { resolveEmailBranding } from './email-shell'

// "$625,000 · 4 bd · 3 ba · 2,450 sqft" — null when there's nothing to show.
export function listingFacts(oh: Row): string | null {
  const facts = [
    oh.listing_price ? String(oh.listing_price) : '',
    oh.bedrooms ? `${oh.bedrooms} bd` : '',
    oh.bathrooms ? `${oh.bathrooms} ba` : '',
    formatArea(oh.square_footage ?? null, oh.country ?? null),
  ].filter(Boolean).join(' · ')
  return facts || null
}

// The agent's (and their team's) upcoming open houses in the same state, next
// 10 days, soonest first — same scope/query as the visitor code email. Best
// effort: a lookup failure returns no rows (the section is just dropped).
export async function loadUpcomingOpenHouses(
  supabase: SupabaseClient,
  agent: Row,
  oh: Row,
  currentOhId: string
): Promise<UpcomingOpenHouse[]> {
  try {
    let agentIds: string[] = [agent.id as string]
    if (agent.brokerage_id) {
      const { data: teammates } = await supabase.from('profiles').select('id').eq('brokerage_id', agent.brokerage_id)
      if (teammates && teammates.length) {
        agentIds = teammates.map(t => t.id)
        if (!agentIds.includes(agent.id as string)) agentIds.push(agent.id as string)
      }
    }
    const nowIso = new Date().toISOString()
    const horizonIso = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    let query = supabase.from('open_houses')
      .select('id, property_address, city, open_house_date, open_house_hours, listing_price, bedrooms, bathrooms, start_at, end_at')
      .in('agent_id', agentIds)
      .neq('id', currentOhId)
      .gte('start_at', nowIso)
      .lte('start_at', horizonIso)
      .order('start_at', { ascending: true })
      .order('city', { ascending: true })
      .limit(5)
    const state = (oh.state || '').trim().replace(/[%_]/g, '')
    if (state) query = query.ilike('state', state)
    const { data } = await query
    return (data ?? []) as UpcomingOpenHouse[]
  } catch {
    return []
  }
}
