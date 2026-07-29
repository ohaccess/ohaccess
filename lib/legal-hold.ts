import { supabaseAdmin as supabase } from './supabase-admin'

// Preservation holds (migration 041). The boolean on each row is the
// enforcement; the legal_holds table is the paper trail. Placing and
// releasing holds is done in SQL — see the runbook in the migration.
//
// Purge paths simply filter held rows out. The two ADMIN hard-delete paths
// can't do that: they exist to destroy records outright (test cleanup, and
// honoring a visitor's §6 deletion request), so they have to refuse instead.
// Privacy Policy §5 already reserves this — deletion requests are honored
// "subject to any legal obligations to retain certain records."
//
// Agent-facing deletes are deliberately NOT gated: they archive before
// deleting, so a held record survives with its hold intact, and the agent
// sees the ordinary result rather than a notice that would tell them their
// records are under preservation.

type HoldCounts = { visitors: number; visitor_archive: number; qr_scans: number; agreement_receipts: number }

export type HoldCheck = {
  held: boolean
  counts: HoldCounts
  /** Human-readable summary for the admin-facing error. */
  summary: string
}

function summarize(counts: HoldCounts): string {
  const parts = [
    counts.visitors && `${counts.visitors} visitor record(s)`,
    counts.visitor_archive && `${counts.visitor_archive} archived record(s)`,
    counts.qr_scans && `${counts.qr_scans} scan log entr(ies)`,
    counts.agreement_receipts && `${counts.agreement_receipts} agreement receipt(s)`,
  ].filter(Boolean)
  return parts.join(', ')
}

async function countHeld(table: string, column: string, value: string): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
    .eq('legal_hold', true)
  return count || 0
}

// Held records tied to one open house, across live, archived, and scan data.
export async function checkOpenHouseHold(openHouseId: string): Promise<HoldCheck> {
  const counts: HoldCounts = {
    visitors: await countHeld('visitors', 'open_house_id', openHouseId),
    visitor_archive: await countHeld('visitor_archive', 'open_house_id', openHouseId),
    qr_scans: await countHeld('qr_scans', 'open_house_id', openHouseId),
    agreement_receipts: await countHeld('agreement_receipts', 'open_house_id', openHouseId),
  }
  const held = counts.visitors + counts.visitor_archive + counts.qr_scans + counts.agreement_receipts > 0
  return { held, counts, summary: summarize(counts) }
}

// Held records tied to one agent. visitor_archive is included even though
// account deletion leaves it in place: if anything of theirs is under a hold,
// tearing down the surrounding account is the wrong move until it's released.
export async function checkAgentHold(agentId: string): Promise<HoldCheck> {
  const counts: HoldCounts = {
    visitors: await countHeld('visitors', 'agent_id', agentId),
    visitor_archive: await countHeld('visitor_archive', 'agent_id', agentId),
    qr_scans: await countHeld('qr_scans', 'agent_id', agentId),
    agreement_receipts: await countHeld('agreement_receipts', 'agent_id', agentId),
  }
  const held = counts.visitors + counts.visitor_archive + counts.qr_scans + counts.agreement_receipts > 0
  return { held, counts, summary: summarize(counts) }
}
