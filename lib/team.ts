import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface BrokerageContext {
  brokerageId: string
  isAdmin: boolean
  tier: 'team' | 'brokerage'
  seatLimit: number
  name: string
  ownerId: string
  logoUrl: string | null
  primaryColor: string | null
  accentColor: string | null
  subscriptionStatus: string | null
}

// Resolve the brokerage a user belongs to and whether they are the admin.
// Returns null if the user has no brokerage. Service-role only — do not
// surface this directly to clients.
export async function getBrokerageContext(userId: string): Promise<BrokerageContext | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('brokerage_id, role')
    .eq('id', userId)
    .single()

  if (!profile?.brokerage_id) return null

  const { data: brokerage } = await supabase
    .from('brokerages')
    .select('id, name, owner_id, tier, seat_limit, logo_url, primary_color, accent_color, subscription_status')
    .eq('id', profile.brokerage_id)
    .single()

  if (!brokerage) return null

  return {
    brokerageId: brokerage.id,
    isAdmin: profile.role === 'brokerage_admin',
    tier: brokerage.tier,
    seatLimit: brokerage.seat_limit,
    name: brokerage.name,
    ownerId: brokerage.owner_id,
    logoUrl: brokerage.logo_url,
    primaryColor: brokerage.primary_color,
    accentColor: brokerage.accent_color,
    subscriptionStatus: brokerage.subscription_status,
  }
}

// Count members + pending (unexpired, unaccepted) invitations against the
// seat limit. Returns { used, limit } so callers can render "7 / 10".
export async function getSeatUsage(brokerageId: string): Promise<{ used: number; limit: number }> {
  const { data: brokerage } = await supabase
    .from('brokerages')
    .select('seat_limit')
    .eq('id', brokerageId)
    .single()

  const limit = brokerage?.seat_limit ?? 0

  const { count: memberCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('brokerage_id', brokerageId)

  const { count: pendingCount } = await supabase
    .from('brokerage_invitations')
    .select('*', { count: 'exact', head: true })
    .eq('brokerage_id', brokerageId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())

  return { used: (memberCount ?? 0) + (pendingCount ?? 0), limit }
}
