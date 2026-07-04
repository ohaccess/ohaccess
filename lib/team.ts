import { supabaseAdmin as supabase } from './supabase-admin'

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
  // The team's funding Stripe subscription (recorded by the webhook). Null for
  // admin-provisioned/invoice-based brokerages — their seats are managed by
  // Dave, not self-serve.
  stripeSubscriptionId: string | null
  crmLeadEmail: string | null
  crmForwardMemberLeads: boolean
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
    .select('id, name, owner_id, tier, seat_limit, logo_url, primary_color, accent_color, subscription_status, stripe_subscription_id, crm_lead_email, crm_forward_member_leads')
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
    stripeSubscriptionId: brokerage.stripe_subscription_id,
    crmLeadEmail: brokerage.crm_lead_email,
    crmForwardMemberLeads: !!brokerage.crm_forward_member_leads,
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

// Ensure `profileId` owns a `brokerages` row and is linked to it as
// brokerage_admin. Idempotent and shared by BOTH the Stripe webhook (Team and
// per-seat Brokerage checkouts / subscription events) and the admin
// provision-brokerage tool (invoice-based 100+ deals).
//
// Adopt-vs-create semantics:
//  - If the owner already has a brokerage, adopt it: update `tier` if it
//    changed (Team → Brokerage upgrade), and sync `seat_limit` ONLY for the
//    per-seat tier (where Stripe's subscription quantity is the source of
//    truth). Flat-Team rows keep whatever seat_limit they have so a manually
//    raised limit is never clobbered back to 10 by a routine event.
//  - Otherwise create it. A 23505 unique violation means a concurrent webhook
//    event won the race — fetch the winner and adopt it the same way.
export async function ensureManagedBrokerage(
  profileId: string,
  opts: { tier: 'team' | 'brokerage'; seatLimit: number; name?: string | null }
): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, brokerage_id, full_name, email')
    .eq('id', profileId)
    .single()
  if (!profile) return null

  const adopt = async (brokerageId: string) => {
    const update: Record<string, string | number> = {}
    const { data: existing } = await supabase
      .from('brokerages')
      .select('id, owner_id, tier, seat_limit')
      .eq('id', brokerageId)
      .maybeSingle()
    if (!existing || existing.owner_id !== profileId) return null
    if (existing.tier !== opts.tier) update.tier = opts.tier
    if (opts.tier === 'brokerage' && existing.seat_limit !== opts.seatLimit) {
      update.seat_limit = opts.seatLimit
    }
    if (Object.keys(update).length > 0) {
      await supabase.from('brokerages').update(update).eq('id', brokerageId)
    }
    return brokerageId
  }

  if (profile.brokerage_id) {
    const adopted = await adopt(profile.brokerage_id)
    if (adopted) return adopted
  }

  const defaultName =
    opts.name?.trim() ||
    profile.full_name?.trim() ||
    (profile.email ? `${profile.email.split('@')[0]}'s Team` : 'My Team')

  const { data: brokerage, error: createErr } = await supabase
    .from('brokerages')
    .insert({
      name: defaultName,
      owner_id: profileId,
      tier: opts.tier,
      seat_limit: opts.seatLimit,
    })
    .select('id')
    .single()

  let brokerageId = brokerage?.id ?? null

  // 23505 = unique violation: a concurrent event already created the row for
  // this owner. Fetch the winner and adopt it instead of erroring out.
  if (createErr) {
    if ((createErr as { code?: string }).code === '23505') {
      const { data: existing } = await supabase
        .from('brokerages')
        .select('id')
        .eq('owner_id', profileId)
        .maybeSingle()
      brokerageId = existing ? await adopt(existing.id) : null
    } else {
      console.error('Failed to create brokerage', { profileId, createErr })
      return null
    }
  }

  if (!brokerageId) return null

  await supabase
    .from('profiles')
    .update({ brokerage_id: brokerageId, role: 'brokerage_admin' })
    .eq('id', profileId)

  return brokerageId
}
