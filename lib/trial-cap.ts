import { trialLimitFor, isExpiredPrepaidAccess } from '@/lib/billing-plans'

// Trial-cap enforcement (Dave's design, 2026-08-24). The free trial ends at
// the cap, with one quiet mercy rule: the open house the cap-crossing visitor
// signed in at may keep collecting until shortly after its scheduled end, so
// an event in progress never starts turning people away at the door. Every
// other open house — including pre-scheduled future ones with printed QR
// signs — shows a closed card at scan time instead of the form. The grace
// rule is deliberately NOT announced anywhere in product copy: the advertised
// wall is the cap, and an unannounced window can't be planned around.

// How long past the event's scheduled end the grace open house keeps
// collecting.
export const GRACE_AFTER_END_MS = 30 * 60_000

// Does the grace window allow an over-cap registration for this open house
// right now? Pure so the rule is unit-testable. `capVisitorOpenHouseId` is
// where the cap-crossing visitor (the last one inside the allowance) signed
// in — grace belongs to that event alone. Legacy open houses without
// structured times get no grace: with no scheduled end there is no window.
// The window opens at start_at even if the cap was crossed earlier (early
// scans before the doors open): the point is that THIS event was promised to
// its visitors, so it gets to run — once, ever, since the cap-crossing
// visitor never changes while the account stays free.
export function graceAllowsRegistration(args: {
  nowMs: number
  openHouseId: string
  startAt: string | null | undefined
  endAt: string | null | undefined
  capVisitorOpenHouseId: string | null | undefined
}): boolean {
  const { nowMs, openHouseId, startAt, endAt, capVisitorOpenHouseId } = args
  if (!startAt || !endAt) return false
  if (capVisitorOpenHouseId !== openHouseId) return false
  const start = Date.parse(startAt)
  const end = Date.parse(endAt)
  if (Number.isNaN(start) || Number.isNaN(end)) return false
  return nowMs >= start && nowMs <= end + GRACE_AFTER_END_MS
}

type ProfileForAccess = {
  id?: string
  tier?: string | null
  sponsor_id?: string | null
  bonus_visitors?: number | null
  billing_interval?: string | null
  stripe_subscription_id?: string | null
  current_period_end?: string | null
} | null | undefined

type SupabaseLike = { from: (table: string) => any }

// Paid-level access, matching the register route and dashboard: a paid tier
// that hasn't lapsed, or coverage by a paying sponsor. Team members read
// tier='team', so paying teams pass the tier check.
export async function agentHasPaidAccess(
  supabase: SupabaseLike,
  profile: ProfileForAccess
): Promise<boolean> {
  if (!profile) return false
  const tierPaid =
    ['pro', 'team', 'brokerage'].includes(profile.tier || 'free') &&
    !isExpiredPrepaidAccess(profile)
  if (tierPaid) return true
  if (!profile.sponsor_id) return false
  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('billing_status')
    .eq('id', profile.sponsor_id)
    .maybeSingle()
  return sponsor?.billing_status === 'active'
}

// The cap-crossing visitor: the last sign-in inside the free allowance, in
// lifetime order. Grace attaches to the open house this row belongs to.
// Ordering ties (same-millisecond sign-ins) break on id so every caller
// resolves the same row. Null while the agent is still under the cap.
export async function capCrossingVisitor(
  supabase: SupabaseLike,
  agentId: string,
  limit: number
): Promise<{ id: string; registered_at: string; open_house_id: string | null } | null> {
  const { data } = await supabase
    .from('visitors')
    .select('id, registered_at, open_house_id')
    .eq('agent_id', agentId)
    .order('registered_at', { ascending: true })
    .order('id', { ascending: true })
    .range(limit - 1, limit - 1)
  return data?.[0] ?? null
}

// Is sign-in closed for this open house? Shared by the register page (shows
// the closed card instead of the form) and worth keeping in one place so the
// page and the API can never disagree. `agent` is the already-fetched profile
// row of the open house's owner.
export async function registrationClosed(
  supabase: SupabaseLike,
  openHouse: { id: string; agent_id: string; start_at?: string | null; end_at?: string | null },
  agent: ProfileForAccess
): Promise<boolean> {
  if (await agentHasPaidAccess(supabase, agent)) return false
  const limit = trialLimitFor(agent)
  const { count } = await supabase
    .from('visitors')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', openHouse.agent_id)
  if ((count ?? 0) < limit) return false
  const cap = await capCrossingVisitor(supabase, openHouse.agent_id, limit)
  return !graceAllowsRegistration({
    nowMs: Date.now(),
    openHouseId: openHouse.id,
    startAt: openHouse.start_at,
    endAt: openHouse.end_at,
    capVisitorOpenHouseId: cap?.open_house_id ?? null,
  })
}

// The account-wide lockout the delete routes enforce server-side: a free
// agent at or past the cap may not remove visitors or open houses — deleting
// rows would pull the lifetime count back under the cap and re-open
// registration, which is exactly the pay-every-other-month game the lockout
// exists to prevent.
export async function agentTrialLocked(
  supabase: SupabaseLike,
  agentId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, tier, sponsor_id, bonus_visitors, billing_interval, stripe_subscription_id, current_period_end')
    .eq('id', agentId)
    .maybeSingle()
  if (await agentHasPaidAccess(supabase, profile)) return false
  const { count } = await supabase
    .from('visitors')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
  return (count ?? 0) >= trialLimitFor(profile)
}
