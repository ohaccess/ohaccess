import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  const allowlist = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(email.toLowerCase())
}

type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  brokerage: string | null
  tier: string | null
  role: string | null
  subscription_status: string | null
  billing_interval: string | null
  current_period_end: string | null
  created_at: string
}

type OpenHouseRow = {
  id: string
  agent_id: string | null
  property_address: string | null
  street_address: string | null
  listing_price: string | null
  open_house_date: string | null
  open_house_hours: string | null
  start_at: string | null
  end_at: string | null
  status: string | null
  code_word: string | null
  created_at: string
}

type VisitorRow = {
  id: string
  open_house_id: string | null
  agent_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  purchasing_timeline: string | null
  verified: boolean | null
  registered_at: string | null
}

const PAYING_STATUSES = new Set(['active', 'trialing', 'past_due'])

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [profilesRes, openHousesRes, visitorsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, full_name, email, brokerage, tier, role, subscription_status, billing_interval, current_period_end, created_at'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('open_houses')
      .select(
        'id, agent_id, property_address, street_address, listing_price, open_house_date, open_house_hours, start_at, end_at, status, code_word, created_at'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('visitors')
      .select(
        'id, open_house_id, agent_id, first_name, last_name, email, phone, purchasing_timeline, verified, registered_at'
      )
      .order('registered_at', { ascending: false }),
  ])

  const firstError = profilesRes.error || openHousesRes.error || visitorsRes.error
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 })
  }

  const profiles = (profilesRes.data || []) as ProfileRow[]
  const openHouses = (openHousesRes.data || []) as OpenHouseRow[]
  const visitors = (visitorsRes.data || []) as VisitorRow[]

  const now = Date.now()
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000

  // Lookup maps
  const agentName = new Map<string, string>()
  for (const p of profiles) {
    agentName.set(p.id, (p.full_name || p.email || 'Unknown').trim() || 'Unknown')
  }

  const ohAddress = new Map<string, string>()
  const ohById = new Map<string, OpenHouseRow>()
  for (const oh of openHouses) {
    ohById.set(oh.id, oh)
    ohAddress.set(oh.id, (oh.street_address || oh.property_address || 'Untitled listing').trim())
  }

  // Per-entity counts
  const visitorsByAgent = new Map<string, number>()
  const visitorsByOpenHouse = new Map<string, number>()
  for (const v of visitors) {
    if (v.agent_id) visitorsByAgent.set(v.agent_id, (visitorsByAgent.get(v.agent_id) || 0) + 1)
    if (v.open_house_id)
      visitorsByOpenHouse.set(v.open_house_id, (visitorsByOpenHouse.get(v.open_house_id) || 0) + 1)
  }

  const openHousesByAgent = new Map<string, number>()
  for (const oh of openHouses) {
    if (oh.agent_id) openHousesByAgent.set(oh.agent_id, (openHousesByAgent.get(oh.agent_id) || 0) + 1)
  }

  // Classify an open house as past or upcoming/present
  const isPastOpenHouse = (oh: OpenHouseRow): boolean => {
    if (oh.end_at) return new Date(oh.end_at).getTime() < now
    if (oh.start_at) return new Date(oh.start_at).getTime() < now
    return (oh.status || '').toLowerCase() === 'archived'
  }

  // ---- Agents ----
  const agents = profiles.map((p) => ({
    id: p.id,
    name: agentName.get(p.id) || 'Unknown',
    email: p.email || '',
    brokerage: p.brokerage || '',
    tier: p.tier || 'free',
    role: p.role || 'agent',
    subscription_status: p.subscription_status || '',
    billing_interval: p.billing_interval || '',
    current_period_end: p.current_period_end,
    created_at: p.created_at,
    openHouseCount: openHousesByAgent.get(p.id) || 0,
    visitorCount: visitorsByAgent.get(p.id) || 0,
  }))

  // ---- Open houses ----
  const openHouseRows = openHouses.map((oh) => ({
    id: oh.id,
    address: ohAddress.get(oh.id) || 'Untitled listing',
    agentId: oh.agent_id || '',
    agentName: oh.agent_id ? agentName.get(oh.agent_id) || 'Unknown' : 'Unknown',
    listing_price: oh.listing_price || '',
    open_house_date: oh.open_house_date || '',
    open_house_hours: oh.open_house_hours || '',
    start_at: oh.start_at,
    end_at: oh.end_at,
    status: oh.status || '',
    code_word: oh.code_word || '',
    isPast: isPastOpenHouse(oh),
    visitorCount: visitorsByOpenHouse.get(oh.id) || 0,
    created_at: oh.created_at,
  }))

  // ---- Visitors ----
  const visitorRows = visitors.map((v) => ({
    id: v.id,
    name: `${v.first_name || ''} ${v.last_name || ''}`.trim() || 'Unknown',
    email: v.email || '',
    phone: v.phone || '',
    purchasing_timeline: v.purchasing_timeline || '',
    verified: !!v.verified,
    registered_at: v.registered_at || '',
    openHouseId: v.open_house_id || '',
    openHouseAddress: v.open_house_id ? ohAddress.get(v.open_house_id) || '—' : '—',
    agentName: v.agent_id ? agentName.get(v.agent_id) || 'Unknown' : 'Unknown',
  }))

  // ---- Stats ----
  const payingAgents = profiles.filter((p) =>
    PAYING_STATUSES.has((p.subscription_status || '').toLowerCase())
  ).length
  const newAgentsThisWeek = profiles.filter(
    (p) => new Date(p.created_at).getTime() >= weekAgo
  ).length
  const upcomingOpenHouses = openHouseRows.filter((o) => !o.isPast).length
  const visitorsThisWeek = visitorRows.filter(
    (v) => v.registered_at && new Date(v.registered_at).getTime() >= weekAgo
  ).length
  const verifiedVisitors = visitorRows.filter((v) => v.verified).length

  const stats = {
    totalAgents: profiles.length,
    payingAgents,
    freeAgents: profiles.length - payingAgents,
    newAgentsThisWeek,
    totalOpenHouses: openHouses.length,
    upcomingOpenHouses,
    pastOpenHouses: openHouses.length - upcomingOpenHouses,
    totalVisitors: visitors.length,
    visitorsThisWeek,
    verifiedVisitors,
  }

  return NextResponse.json({
    stats,
    agents,
    openHouses: openHouseRows,
    visitors: visitorRows,
    generatedAt: new Date().toISOString(),
  })
}
