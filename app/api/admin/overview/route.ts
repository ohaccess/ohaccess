import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'
import { ohStatus } from '@/lib/oh-status'

type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  brokerage: string | null
  brokerage_id: string | null
  tier: string | null
  role: string | null
  subscription_status: string | null
  stripe_subscription_id: string | null
  subscription_canceled_at: string | null
  billing_interval: string | null
  current_period_end: string | null
  bonus_visitors: number | null
  referral_source: string | null
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
  ip_address: string | null
}

type ScanRow = {
  open_house_id: string | null
  agent_id: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// Lifetime / last-12-months / last-30-days counts for the marketing funnel.
type WindowCounts = { lifetime: number; last12mo: number; last30d: number }

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
        'id, full_name, email, phone, brokerage, brokerage_id, tier, role, subscription_status, stripe_subscription_id, subscription_canceled_at, billing_interval, current_period_end, bonus_visitors, referral_source, created_at'
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
        'id, open_house_id, agent_id, first_name, last_name, email, phone, purchasing_timeline, verified, registered_at, ip_address'
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

  // Last-login times live on the auth records, not in profiles.
  const lastSignIn = new Map<string, string | null>()
  for (let page = 1; ; page++) {
    const { data: list, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !list?.users?.length) break
    for (const u of list.users) lastSignIn.set(u.id, u.last_sign_in_at || null)
    if (list.users.length < 1000) break
  }

  const now = Date.now()
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  const d30Iso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  const m12Iso = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString()

  // ---- Lifetime funnel (live tables + the deletion archives + qr_scans) ----
  // Archives keep dashboard cleanup from erasing history, so lifetime counts
  // = live rows + archived rows. Count queries (head:true) keep this cheap.
  const countRows = async (table: string, dateCol: string, sinceIso?: string) => {
    let q = supabase.from(table).select('id', { count: 'exact', head: true })
    if (sinceIso) q = q.gte(dateCol, sinceIso)
    const { count } = await q
    return count || 0
  }
  const windowed = async (
    liveCount: (sinceIso?: string) => number,
    archiveTable: string | null,
    archiveDateCol: string
  ): Promise<WindowCounts> => {
    const [aLife, a12, a30] = archiveTable
      ? await Promise.all([
          countRows(archiveTable, archiveDateCol),
          countRows(archiveTable, archiveDateCol, m12Iso),
          countRows(archiveTable, archiveDateCol, d30Iso),
        ])
      : [0, 0, 0]
    return {
      lifetime: liveCount() + aLife,
      last12mo: liveCount(m12Iso) + a12,
      last30d: liveCount(d30Iso) + a30,
    }
  }

  const inWindow = (dates: (string | null)[], sinceIso?: string) =>
    sinceIso ? dates.filter((d) => d && d >= sinceIso).length : dates.length

  const ohDates = openHouses.map((oh) => oh.created_at)
  const visitorDates = visitors.map((v) => v.registered_at)
  const [openHousesCreated, visitorsLogged, scanCounts] = await Promise.all([
    windowed((s) => inWindow(ohDates, s), 'open_house_archive', 'oh_created_at'),
    windowed((s) => inWindow(visitorDates, s), 'visitor_archive', 'registered_at'),
    (async (): Promise<WindowCounts> => ({
      lifetime: await countRows('qr_scans', 'created_at'),
      last12mo: await countRows('qr_scans', 'created_at', m12Iso),
      last30d: await countRows('qr_scans', 'created_at', d30Iso),
    }))(),
  ])

  // Recent scans that never became a registration ("scanned but didn't
  // submit"): a scan converts when a visitor row exists for the same open
  // house from the same IP. Matched against live visitors only — good
  // enough for a recent-activity view.
  const { data: recentScansData } = await supabase
    .from('qr_scans')
    .select('open_house_id, agent_id, ip_address, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  const recentScans = (recentScansData || []) as ScanRow[]

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

  // A team MEMBER (not the owner/admin) who still has an active personal
  // subscription that isn't already winding down is being double-charged: the
  // team covers their seat AND Stripe is still billing them. Flag for one-click
  // resolution in the admin UI.
  const isDoubleBilled = (p: ProfileRow): boolean =>
    !!p.brokerage_id &&
    p.role !== 'brokerage_admin' &&
    !!p.stripe_subscription_id &&
    PAYING_STATUSES.has((p.subscription_status || '').toLowerCase()) &&
    !p.subscription_canceled_at

  // ---- Agents ----
  const agents = profiles.map((p) => ({
    id: p.id,
    name: agentName.get(p.id) || 'Unknown',
    email: p.email || '',
    phone: p.phone || '',
    brokerage: p.brokerage || '',
    tier: p.tier || 'free',
    role: p.role || 'agent',
    subscription_status: p.subscription_status || '',
    billing_interval: p.billing_interval || '',
    current_period_end: p.current_period_end,
    bonus_visitors: p.bonus_visitors || 0,
    referral_source: p.referral_source || '',
    // Gifted (comped) access: paid tier with no Stripe subscription behind it.
    comped: p.billing_interval === 'comped' && !p.stripe_subscription_id,
    created_at: p.created_at,
    last_sign_in_at: lastSignIn.get(p.id) || null,
    openHouseCount: openHousesByAgent.get(p.id) || 0,
    visitorCount: visitorsByAgent.get(p.id) || 0,
    doubleBilling: isDoubleBilled(p),
  }))

  // ---- Open houses ----
  // Three-way when: past / current (live right now) / future — same shared
  // helper the Map tab pins use, so table badges and pin colors always agree.
  const openHouseRows = openHouses.map((oh) => {
    const when = ohStatus(oh, now)
    return {
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
      when,
      isPast: when === 'past',
      visitorCount: visitorsByOpenHouse.get(oh.id) || 0,
      created_at: oh.created_at,
    }
  })

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
    doubleBilled: profiles.filter(isDoubleBilled).length,
    newAgentsThisWeek,
    totalOpenHouses: openHouses.length,
    upcomingOpenHouses,
    pastOpenHouses: openHouses.length - upcomingOpenHouses,
    totalVisitors: visitors.length,
    visitorsThisWeek,
    verifiedVisitors,
  }

  // ---- Scan funnel ----
  // A scan "converted" when a visitor registered for the same open house
  // from the same IP (visitors carry ip_address since migration 024, so
  // older scans/visitors without one just can't match — shown as-is).
  const convertedKeys = new Set(
    visitors
      .filter((v) => v.open_house_id && v.ip_address)
      .map((v) => `${v.open_house_id}|${v.ip_address}`)
  )
  const abandonedScans = recentScans
    .filter(
      (s) => !(s.open_house_id && s.ip_address && convertedKeys.has(`${s.open_house_id}|${s.ip_address}`))
    )
    .slice(0, 30)
    .map((s) => ({
      scanned_at: s.created_at,
      openHouseAddress: s.open_house_id ? ohAddress.get(s.open_house_id) || '(deleted open house)' : '—',
      agentName: s.agent_id ? agentName.get(s.agent_id) || 'Unknown' : 'Unknown',
      ip_address: s.ip_address || '—',
      user_agent: (s.user_agent || '—').slice(0, 80),
    }))

  // Conversion = share of the last 30 days' scans that became a registration
  // (same open house + IP). Deliberately scan-based, NOT registrations÷scans:
  // registrations predate the scan log (live since 2026-07-20), so that ratio
  // reads absurdly high (1,000%+) until the log has 30 days of history.
  // recentScans is capped at 200, so with heavy traffic this becomes a
  // most-recent-200 sample — fine for a dashboard read.
  const d30Ms = Date.now() - 30 * 24 * 60 * 60 * 1000
  const scans30 = recentScans.filter((s) => new Date(s.created_at).getTime() >= d30Ms)
  const converted30 = scans30.filter(
    (s) => s.open_house_id && s.ip_address && convertedKeys.has(`${s.open_house_id}|${s.ip_address}`)
  ).length

  const funnel = {
    openHousesCreated,
    visitorsLogged,
    scans: scanCounts,
    conversionPct30d: scans30.length > 0 ? Math.round((converted30 / scans30.length) * 100) : null,
    abandonedScans,
  }

  return NextResponse.json({
    stats,
    funnel,
    agents,
    openHouses: openHouseRows,
    visitors: visitorRows,
    generatedAt: new Date().toISOString(),
  })
}
