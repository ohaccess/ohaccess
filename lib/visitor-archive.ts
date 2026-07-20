import { supabaseAdmin as supabase } from './supabase-admin'

// Matches the Privacy Policy §5 visitor-data retention window ("up to 3
// years from the date of collection") and the qr_scans purge.
const RETENTION_MS = 3 * 365 * 24 * 60 * 60 * 1000

// Copy an open house's visitor log into visitor_archive before the rows are
// deleted, so an agent's dashboard cleanup can't destroy the record of who
// was inside the house. Throws on failure — callers must abort the delete
// rather than silently lose the log. Returns the number of rows archived.
export async function archiveVisitorsForOpenHouse(openHouseId: string): Promise<number> {
  const { data: oh } = await supabase
    .from('open_houses')
    .select('property_address, agent_id')
    .eq('id', openHouseId)
    .maybeSingle()

  const { data: visitors, error: readErr } = await supabase
    .from('visitors')
    .select(
      'id, agent_id, first_name, last_name, email, phone, purchasing_timeline, source, notes, sms_opted_out, ip_address, user_agent, phone_carrier, phone_line_type, registered_at'
    )
    .eq('open_house_id', openHouseId)
  if (readErr) throw new Error(`visitor_archive read: ${readErr.message}`)
  if (!visitors || visitors.length === 0) return 0

  const now = Date.now()
  const rows = visitors.map((v) => {
    // Anchor the purge date on the ORIGINAL registration (collection) time,
    // so archiving never extends the promised retention window.
    const collected = Date.parse(v.registered_at ?? '')
    return {
      visitor_id: v.id,
      open_house_id: openHouseId,
      agent_id: v.agent_id ?? oh?.agent_id ?? null,
      property_address: oh?.property_address ?? null,
      first_name: v.first_name,
      last_name: v.last_name,
      email: v.email,
      phone: v.phone,
      purchasing_timeline: v.purchasing_timeline,
      source: v.source,
      notes: v.notes,
      sms_opted_out: v.sms_opted_out,
      ip_address: v.ip_address,
      user_agent: v.user_agent,
      phone_carrier: v.phone_carrier,
      phone_line_type: v.phone_line_type,
      registered_at: v.registered_at,
      purge_after: new Date((Number.isNaN(collected) ? now : collected) + RETENTION_MS).toISOString(),
    }
  })

  const { error: insertErr } = await supabase.from('visitor_archive').insert(rows)
  if (insertErr) throw new Error(`visitor_archive insert: ${insertErr.message}`)

  // Opportunistic retention purge — archive ops are rare, so run it every
  // time rather than the 1%-lottery the hot-path tables use. Best-effort.
  await supabase.from('visitor_archive').delete().lt('purge_after', new Date(now).toISOString())

  return rows.length
}
