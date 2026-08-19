import 'server-only'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { isExpiredPrepaidAccess, trialLimitFor } from '@/lib/billing-plans'
import { isEmail } from '@/lib/register-helpers'
import { escapeHtml } from '@/lib/escape-html'
import { inferProfileCountry } from '@/lib/regions'

// Expired-link referral loop: when a visitor scans the QR for an open house
// that no longer exists, the register page falls back to a lead-capture card.
// Whose lead it becomes depends on the hosting agent's standing:
//   - agent still on trial (under the visitor cap) or on a paid plan
//     → the page shows the agent's contact info and the lead is emailed to them
//   - agent lapsed (over the trial cap, not paying)
//     → the lead goes to ohACCESS instead (the pre-existing behavior)
// The agent is recovered from open_house_archive, which keeps agent_id after
// an agent-side delete. Admin hard-deletes and pre-archive deletions leave no
// row, so those links fall back to the ohACCESS path.

// The public contact card shown to the visitor. Display fields only — no ids,
// no billing state.
export type ExpiredAgentContact = {
  fullName: string | null
  brokerage: string | null
  email: string
  phone: string | null
  propertyAddress: string | null
  // ISO country of the agent — the lead form's default phone dial code.
  country: string
}

type StandingFields = {
  tier?: string | null
  billing_interval?: string | null
  stripe_subscription_id?: string | null
  current_period_end?: string | null
  bonus_visitors?: number | null
}

// Mirrors the register route's isPro + trial-cap rules exactly: a paid tier
// that hasn't hit prepaid/comp expiry, or coverage by a paying sponsor, is
// good standing regardless of visitor count; otherwise the agent is in good
// standing only while still under their personal trial cap.
export function agentInGoodStanding(
  profile: StandingFields | null | undefined,
  sponsorActive: boolean,
  visitorCount: number
): boolean {
  if (!profile) return false
  const tier = profile.tier || 'free'
  const paid =
    ['pro', 'team', 'brokerage'].includes(tier) && !isExpiredPrepaidAccess(profile)
  if (paid || sponsorActive) return true
  return visitorCount < trialLimitFor(profile)
}

// open_houses.id is a uuid; anything else can't match the archive either.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Recover the deleted open house's agent and return their contact card —
// but ONLY when they're in good standing. Lapsed, unknown, or account-deleted
// agents return null and the caller falls back to the ohACCESS lead path.
export async function resolveExpiredAgent(
  openHouseId: string
): Promise<ExpiredAgentContact | null> {
  if (!UUID_RE.test(openHouseId)) return null

  const { data: archived } = await supabase
    .from('open_house_archive')
    .select('agent_id, property_address')
    .eq('open_house_id', openHouseId)
    .order('deleted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!archived?.agent_id) return null

  // select('*'): `country` (migration 048) may not exist yet on a database
  // the code reached first — naming it would fail the whole lookup and
  // wrongly route the lead to ohACCESS instead of the agent.
  const { data: agent } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', archived.agent_id)
    .maybeSingle()
  if (!agent) return null

  let sponsorActive = false
  if (agent.sponsor_id) {
    const { data: sponsorRow } = await supabase
      .from('sponsors')
      .select('billing_status')
      .eq('id', agent.sponsor_id)
      .maybeSingle()
    sponsorActive = sponsorRow?.billing_status === 'active'
  }

  // Visitor count only matters for the trial rule, so skip the query when the
  // tier/sponsor already settles it (same shape as the register route). Good
  // standing at an impossible count means the count can't be the reason.
  let visitorCount = 0
  const paidOrSponsored = agentInGoodStanding(agent, sponsorActive, Number.MAX_SAFE_INTEGER)
  if (!paidOrSponsored) {
    const { count } = await supabase
      .from('visitors')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent.id)
    visitorCount = count ?? 0
  }

  if (!agentInGoodStanding(agent, sponsorActive, visitorCount)) return null

  const email = isEmail(agent.display_email) ? agent.display_email.trim() : agent.email
  if (!isEmail(email)) return null

  return {
    fullName: agent.full_name || null,
    brokerage: agent.brokerage || null,
    email,
    phone: agent.phone || null,
    propertyAddress: archived.property_address || null,
    country: inferProfileCountry(agent),
  }
}

export type ExpiredLead = {
  name: string
  email: string
  phone: string
  zip: string
}

// The lead email sent to the agent. Pure so it's unit-testable; every
// visitor-supplied value is HTML-escaped.
export function buildExpiredLeadEmail(
  agent: { fullName: string | null; propertyAddress: string | null },
  lead: ExpiredLead
): { subject: string; html: string } {
  const address = agent.propertyAddress
  const subject = address
    ? `🏠 Buyer lead from your open house QR — ${address}`
    : '🏠 Buyer lead from your open house QR'
  const safeName = escapeHtml(lead.name)
  const safeEmail = escapeHtml(lead.email)
  const safePhone = escapeHtml(lead.phone)
  const safeZip = escapeHtml(lead.zip)
  const safeAddress = escapeHtml(address || '')
  const greetName = escapeHtml(agent.fullName || 'there')

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 20px;">
      <div style="background: #1d1d1f; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
        <div style="font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
        <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">New Buyer Lead</div>
      </div>
      <div style="background: white; border-radius: 0 0 16px 16px; padding: 24px;">
        <div style="font-size: 14px; color: #1d1d1f; line-height: 1.6; margin-bottom: 16px;">
          Hi ${greetName} — a home shopper just scanned the QR code for your past open house${safeAddress ? ` at <strong>${safeAddress}</strong>` : ''}. That event link has expired, so ohACCESS collected their details for you:
        </div>
        <div style="background: #f5f5f7; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
          <div style="font-size: 11px; color: #6e6e73; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Lead Details</div>
          <div style="font-size: 14px; color: #1d1d1f; margin-bottom: 6px;"><strong>Name:</strong> ${safeName}</div>
          <div style="font-size: 14px; color: #1d1d1f; margin-bottom: 6px;"><strong>Email:</strong> <a href="mailto:${safeEmail}" style="color: #0071e3;">${safeEmail}</a></div>
          <div style="font-size: 14px; color: #1d1d1f; margin-bottom: 6px;"><strong>Phone:</strong> ${safePhone}</div>
          <div style="font-size: 14px; color: #1d1d1f;"><strong>Zip / Postal Code:</strong> ${safeZip}</div>
        </div>
        <div style="font-size: 13px; color: #6e6e73; line-height: 1.6;">
          Reply to this email to reach them directly.
        </div>
      </div>
      <div style="text-align: center; padding: 16px; font-size: 11px; color: #aeaeb2;">
        Sent by ohACCESS · www.ohaccess.com
      </div>
    </div>`

  return { subject, html }
}
