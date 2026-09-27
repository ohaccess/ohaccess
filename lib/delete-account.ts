import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { archiveVisitorsForAgent } from '@/lib/visitor-archive'
import { checkAgentHold, type HoldCounts } from '@/lib/legal-hold'

// The one place an agent account is torn down. Shared by the admin
// delete-account route, the agent's own Close-account button
// (/api/account/close), and the daily cron that runs scheduled closures.
//
// Order matters and nothing here is transactional across PostgREST calls:
// the live visitor log is ARCHIVED first (Privacy Policy §5 retention is a
// flat 3 years from collection with no account-deletion trigger, so closing
// an account must not destroy the record of who was inside a house), then
// children before parents, then the profile, then the auth login itself.

export class AccountLegalHoldError extends Error {
  counts: HoldCounts
  summary: string
  constructor(summary: string, counts: HoldCounts) {
    super(`Blocked by a legal hold on this agent's data (${summary})`)
    this.name = 'AccountLegalHoldError'
    this.summary = summary
    this.counts = counts
  }
}

export class AccountArchiveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AccountArchiveError'
  }
}

export type DeletedAccountSummary = {
  email: string
  name: string
  visitors: number
  visitorsArchived: number
  openHouses: number
  shortUrls: number
  brokeragesDeleted: number
  membersDetached: number
}

// Helper: run a delete and throw a labeled error so the caller knows which
// step failed.
async function del(step: string, run: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await run
  if (error) throw new Error(`${step}: ${error.message}`)
}

// `actor` is only for the log line ("admin dave@..." / "self" / "cron").
// Throws AccountLegalHoldError (nothing deleted), AccountArchiveError
// (nothing deleted), or a plain Error naming the step that failed partway.
export async function deleteAgentAccount(
  userId: string,
  profile: { id: string; email: string | null; full_name: string | null },
  actor: string
): Promise<DeletedAccountSummary> {
  const counts = async (table: string, column: string) => {
    const { count } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(column, userId)
    return count || 0
  }
  const visitorCount = await counts('visitors', 'agent_id')
  const openHouseCount = await counts('open_houses', 'agent_id')
  const shortUrlCount = await counts('short_urls', 'agent_id')

  // Brokerages this account owns (owner_id is ON DELETE RESTRICT, so these
  // must go before the auth user can be removed). Deleting a brokerage
  // cascades its invitations and detaches its member agents (brokerage_id
  // is ON DELETE SET NULL on profiles).
  const { data: ownedBrokerages } = await supabase
    .from('brokerages')
    .select('id')
    .eq('owner_id', userId)
  const ownedIds = (ownedBrokerages || []).map((b) => b.id)
  let membersDetached = 0
  if (ownedIds.length) {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('brokerage_id', ownedIds)
      .neq('id', userId)
    membersDetached = count || 0
  }

  // Preservation hold (migration 041): if anything of this agent's is under
  // a hold, don't tear down the surrounding account until it's released.
  const hold = await checkAgentHold(userId)
  if (hold.held) {
    console.warn(`[DELETE-ACCOUNT] BLOCKED by legal hold (${actor}): ${profile.email} — ${hold.summary}`)
    throw new AccountLegalHoldError(hold.summary, hold.counts)
  }

  let visitorsArchived = 0
  try {
    visitorsArchived = await archiveVisitorsForAgent(userId)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error(`[DELETE-ACCOUNT] archive FAILED (${actor}) on ${profile.email}: ${message}`)
    throw new AccountArchiveError(message)
  }

  try {
    // Children first, then parents. Existing visitor_archive rows are
    // deliberately KEPT (Dave, 2026-07-20) for the same reason as above —
    // they survive until the monthly retention purge
    // (/api/cron/data-retention) ages them out at the 3-year mark.
    await del('visitors', supabase.from('visitors').delete().eq('agent_id', userId))
    await del('short_urls', supabase.from('short_urls').delete().eq('agent_id', userId))
    // Agreement receipts carry visitor PII (migration 043) — a hard-delete
    // clears them; held ones were caught by the checkAgentHold gate above.
    await del('agreement_receipts', supabase.from('agreement_receipts').delete().eq('agent_id', userId))
    await del('open_houses', supabase.from('open_houses').delete().eq('agent_id', userId))
    if (ownedIds.length) {
      await del('brokerages', supabase.from('brokerages').delete().eq('owner_id', userId))
    }
    // Blank agreement-template files live under <userId>/ in the private
    // bucket (043). Best-effort: an orphaned blank form is unreachable and
    // holds no visitor data, so a cleanup failure must not fail the deletion.
    try {
      const { data: files } = await supabase.storage.from('agreement-templates').list(userId)
      if (files && files.length > 0) {
        await supabase.storage.from('agreement-templates').remove(files.map(f => `${userId}/${f.name}`))
      }
    } catch (e) {
      console.error('[DELETE-ACCOUNT] agreement-template storage cleanup failed:', e)
    }
    await del('profile', supabase.from('profiles').delete().eq('id', userId))

    // Finally remove the auth login itself.
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)
    if (authError) throw new Error(`auth user: ${authError.message}`)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error(`[DELETE-ACCOUNT] FAILED (${actor}) on ${profile.email}: ${message}`)
    throw e
  }

  console.log(
    `[DELETE-ACCOUNT] ${actor} deleted ${profile.email} (${profile.id}) — ` +
      `${visitorCount} visitors (${visitorsArchived} archived), ${openHouseCount} open houses, ${shortUrlCount} short URLs, ` +
      `${ownedIds.length} brokerages, ${membersDetached} members detached, at ${new Date().toISOString()}`
  )

  return {
    email: profile.email || '',
    name: profile.full_name || profile.email || '',
    visitors: visitorCount,
    visitorsArchived,
    openHouses: openHouseCount,
    shortUrls: shortUrlCount,
    brokeragesDeleted: ownedIds.length,
    membersDetached,
  }
}
