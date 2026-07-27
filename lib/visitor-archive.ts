import { supabaseAdmin as supabase } from './supabase-admin'

// Matches the Privacy Policy §5 visitor-data retention window ("up to 3
// years from the date of collection") and the qr_scans purge.
const RETENTION_MS = 3 * 365 * 24 * 60 * 60 * 1000

// Every column of `visitors` that the archive preserves. Keep this in sync
// with the visitor_archive table (migrations 026 + 040) — a field missing
// here is silently dropped at archive time and is NOT recoverable, because
// the source row is deleted moments later.
//
// The only deliberate omission is feedback_token: a live one-time capability
// handle, not a record of anything (see migration 040).
// NB: must stay ONE string literal — Supabase infers the row type from it at
// compile time, and a concatenated string degrades to an untyped result.
const VISITOR_FIELDS =
  'id, open_house_id, agent_id, first_name, last_name, email, phone, purchasing_timeline, source, notes, sms_opted_out, ip_address, user_agent, phone_carrier, phone_line_type, registered_at, sponsor_id, sponsor_name, disclosures_sent, lang, custom_answers, email_message_id, email_status, sms_message_sid, sms_status, delivery_updated_at, feedback_rating, feedback_price, feedback_submitted_at, thank_you_sent_at'

type ArchivableVisitor = {
  id: string
  open_house_id: string | null
  agent_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  purchasing_timeline: string | null
  source: string | null
  notes: string | null
  sms_opted_out: boolean | null
  ip_address: string | null
  user_agent: string | null
  phone_carrier: string | null
  phone_line_type: string | null
  registered_at: string | null
  // Consent evidence — what this visitor was actually shown and agreed to.
  sponsor_id: string | null
  sponsor_name: string | null
  disclosures_sent: unknown
  lang: string | null
  custom_answers: unknown
  // Delivery proof — that the codeword reached the phone/inbox.
  email_message_id: string | null
  email_status: string | null
  sms_message_sid: string | null
  sms_status: string | null
  delivery_updated_at: string | null
  // Post-visit record.
  feedback_rating: number | null
  feedback_price: string | null
  feedback_submitted_at: string | null
  thank_you_sent_at: string | null
}

function toArchiveRow(v: ArchivableVisitor, propertyAddress: string | null, fallbackAgentId: string | null) {
  // Anchor the purge date on the ORIGINAL registration (collection) time,
  // so archiving never extends the promised retention window.
  const collected = Date.parse(v.registered_at ?? '')
  return {
    visitor_id: v.id,
    open_house_id: v.open_house_id,
    agent_id: v.agent_id ?? fallbackAgentId,
    property_address: propertyAddress,
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
    sponsor_id: v.sponsor_id,
    sponsor_name: v.sponsor_name,
    disclosures_sent: v.disclosures_sent ?? null,
    lang: v.lang,
    custom_answers: v.custom_answers ?? null,
    email_message_id: v.email_message_id,
    email_status: v.email_status,
    sms_message_sid: v.sms_message_sid,
    sms_status: v.sms_status,
    delivery_updated_at: v.delivery_updated_at,
    feedback_rating: v.feedback_rating,
    feedback_price: v.feedback_price,
    feedback_submitted_at: v.feedback_submitted_at,
    thank_you_sent_at: v.thank_you_sent_at,
    purge_after: new Date(
      (Number.isNaN(collected) ? Date.now() : collected) + RETENTION_MS
    ).toISOString(),
  }
}

// Opportunistic retention purge — archive ops are rare, so run it every
// time rather than the 1%-lottery the hot-path tables use. Best-effort.
async function purgeExpired() {
  await supabase.from('visitor_archive').delete().lt('purge_after', new Date().toISOString())
}

// Copy an open house's visitor log into visitor_archive AND the listing
// record into open_house_archive before the rows are deleted, so an agent's
// dashboard cleanup can't destroy the record of who was inside the house or
// the lifetime created/logged stats. Throws on failure — callers must abort
// the delete rather than silently lose the log. Returns rows archived.
export async function archiveVisitorsForOpenHouse(openHouseId: string): Promise<number> {
  const { data: oh } = await supabase
    .from('open_houses')
    .select('property_address, street_address, listing_price, start_at, end_at, created_at, agent_id')
    .eq('id', openHouseId)
    .maybeSingle()

  const { data: visitors, error: readErr } = await supabase
    .from('visitors')
    .select(VISITOR_FIELDS)
    .eq('open_house_id', openHouseId)
  if (readErr) throw new Error(`visitor_archive read: ${readErr.message}`)

  // Archive the listing record itself (open_house_archive, migration 027) —
  // even a zero-visitor open house counts toward lifetime marketing stats.
  if (oh) {
    const { error: ohArchiveErr } = await supabase.from('open_house_archive').insert({
      open_house_id: openHouseId,
      agent_id: oh.agent_id ?? null,
      property_address: oh.property_address ?? null,
      street_address: oh.street_address ?? null,
      listing_price: oh.listing_price ?? null,
      start_at: oh.start_at ?? null,
      end_at: oh.end_at ?? null,
      visitor_count: visitors?.length ?? 0,
      oh_created_at: oh.created_at ?? null,
    })
    if (ohArchiveErr) throw new Error(`open_house_archive insert: ${ohArchiveErr.message}`)
  }

  if (!visitors || visitors.length === 0) return 0

  const rows = (visitors as ArchivableVisitor[]).map((v) =>
    toArchiveRow(v, oh?.property_address ?? null, oh?.agent_id ?? null)
  )
  const { error: insertErr } = await supabase.from('visitor_archive').insert(rows)
  if (insertErr) throw new Error(`visitor_archive insert: ${insertErr.message}`)

  await purgeExpired()
  return rows.length
}

// Copy EVERY visitor belonging to one agent into visitor_archive before the
// admin account-deletion tool wipes their rows. Privacy Policy §5 retention
// is a flat 3 years from collection with no account-deletion trigger, so
// closing an agent's account must not shorten the clock on the record of who
// was inside a house. Throws on failure — the caller must abort the delete.
// Returns rows archived.
//
// The property address is captured here because the agent's open_houses rows
// are deleted moments later; after that there is nothing left to join to.
//
// NOT a purge path: honoring a visitor's own §6 deletion request still goes
// through the admin delete-open-house tool, which stays a true hard delete.
export async function archiveVisitorsForAgent(agentId: string): Promise<number> {
  const { data: visitors, error: readErr } = await supabase
    .from('visitors')
    .select(VISITOR_FIELDS)
    .eq('agent_id', agentId)
  if (readErr) throw new Error(`visitor_archive read: ${readErr.message}`)
  if (!visitors || visitors.length === 0) return 0

  const { data: openHouses } = await supabase
    .from('open_houses')
    .select('id, property_address')
    .eq('agent_id', agentId)
  const addressById = new Map(
    (openHouses || []).map((oh) => [oh.id as string, (oh.property_address as string) ?? null])
  )

  const rows = (visitors as ArchivableVisitor[]).map((v) =>
    toArchiveRow(v, v.open_house_id ? addressById.get(v.open_house_id) ?? null : null, agentId)
  )
  const { error: insertErr } = await supabase.from('visitor_archive').insert(rows)
  if (insertErr) throw new Error(`visitor_archive insert: ${insertErr.message}`)

  await purgeExpired()
  return rows.length
}

// Copy ONE visitor into visitor_archive before an individual delete (the
// dashboard's "Delete visitor" button). Throws on failure — the caller must
// abort the delete rather than silently lose the record. No-op if the
// visitor doesn't exist.
export async function archiveVisitorById(visitorId: string): Promise<void> {
  const { data: v, error: readErr } = await supabase
    .from('visitors')
    .select(VISITOR_FIELDS)
    .eq('id', visitorId)
    .maybeSingle()
  if (readErr) throw new Error(`visitor_archive read: ${readErr.message}`)
  if (!v) return

  const visitor = v as ArchivableVisitor
  let propertyAddress: string | null = null
  if (visitor.open_house_id) {
    const { data: oh } = await supabase
      .from('open_houses')
      .select('property_address')
      .eq('id', visitor.open_house_id)
      .maybeSingle()
    propertyAddress = oh?.property_address ?? null
  }

  const { error: insertErr } = await supabase
    .from('visitor_archive')
    .insert(toArchiveRow(visitor, propertyAddress, null))
  if (insertErr) throw new Error(`visitor_archive insert: ${insertErr.message}`)

  await purgeExpired()
}
