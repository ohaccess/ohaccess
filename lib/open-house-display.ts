import 'server-only'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { normalizeCustomQuestions, questionsForSurface } from '@/lib/custom-questions'
import { inferProfileCountry, normalizeCountry } from '@/lib/regions'
import { whatsAppConfigured, whatsAppFirstCountries } from '@/lib/messaging-channel'

// The shape handed to the register page — safe display fields only.
export type OpenHouseDisplay = NonNullable<Awaited<ReturnType<typeof getOpenHouseDisplay>>>

// Public, read-only display data for the visitor registration page. Returns
// ONLY safe fields — never the secret code_word/code_word_email, and only the
// agent's public-facing branding (name + colors). Runs with the service role
// so it works once RLS locks the open_houses/profiles tables to their owners.
//
// Shared by the /register/[id] server page (which renders the form with the
// data already in place — no client fetch round trip) and the GET handler at
// /api/open-house/[id].
// open_houses.id is a Postgres uuid column. Anything else in the URL — a
// bot probing /register/admin, a mangled QR link — is guaranteed not to
// match, so answer "not found" without a query. Skipping the round trip
// also keeps "invalid input syntax for type uuid" noise out of the DB logs.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getOpenHouseDisplay(
  id: string,
  scan: { ip: string; userAgent: string | null }
) {
  if (!UUID_RE.test(id)) return null

  // select('*') rather than a column list: this is the one public page of
  // the product, and a column that's in the code but not yet in the database
  // (a deploy landing before its migration — e.g. 048's `country`) would
  // otherwise 404 every sign-in. Only the safe fields below are returned.
  const { data: oh, error } = await supabase
    .from('open_houses')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !oh) return null

  // Scan log: every load of the register form records IP + device +
  // timestamp (qr_scans, migration 025), so a QR scan leaves a forensic
  // trail even when the visitor abandons the form. Best-effort — a logging
  // failure must never break the page. Rows older than the 3-year visitor
  // retention window are purged opportunistically (rate_limits pattern).
  const { error: scanErr } = await supabase.from('qr_scans').insert({
    open_house_id: oh.id,
    agent_id: oh.agent_id,
    ip_address: scan.ip,
    user_agent: scan.userAgent,
  })
  if (scanErr) console.error('qr_scans log failed:', scanErr)
  if (Math.random() < 0.01) {
    const cutoff = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString()
    // Skips rows under a preservation hold (migration 041).
    await supabase.from('qr_scans').delete().lt('created_at', cutoff).eq('legal_hold', false)
  }

  const { data: agent } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', oh.agent_id)
    .maybeSingle()

  // The agent's one extra sign-in question, if they've configured one. Safe to
  // expose: it's a prompt the visitor is about to be shown anyway. The
  // success-screen questions are NOT sent here — those come back from
  // /api/register, so they're only revealed to someone who actually signed in.
  const signinQuestions = questionsForSurface(
    normalizeCustomQuestions(agent?.custom_questions),
    'signin'
  )

  // Sponsor disclosure: when the agent has an accepted sponsor, the sign-in
  // form must NAME them in the consent language. Only the public display name
  // is exposed — no contact info, no ids.
  let sponsorName: string | null = null
  if (agent?.sponsor_id) {
    const { data: sponsor } = await supabase
      .from('sponsors')
      .select('full_name, company')
      .eq('id', agent.sponsor_id)
      .maybeSingle()
    if (sponsor?.full_name) {
      sponsorName = sponsor.company
        ? `${sponsor.full_name} (${sponsor.company})`
        : sponsor.full_name
    }
  }

  // Which country the property is in — decides the default dial code on the
  // sign-in form's phone field and whether the US-only NAR notice shows.
  // Rows from before migration 048 have no country; the agent's (saved or
  // inferred) country stands in, which for those rows is US or Canada.
  const country = normalizeCountry(oh.country) ?? inferProfileCountry(agent)

  // Shape matches what the register page expects: open-house fields with a
  // nested `profiles` object for the agent's branding. agent_id is
  // intentionally omitted.
  return {
    id: oh.id,
    property_address: oh.property_address,
    country,
    // Lets the form say "WhatsApp" instead of "SMS" for numbers that will be
    // messaged that way (lib/messaging-channel.ts). Nothing secret: the
    // sender/template SIDs stay server-side; only the on/off + country list.
    whatsapp: {
      enabled: whatsAppConfigured(),
      countries: whatsAppConfigured() ? [...whatsAppFirstCountries()] : [],
    },
    listing_price: oh.listing_price,
    bedrooms: oh.bedrooms,
    bathrooms: oh.bathrooms,
    square_footage: oh.square_footage,
    open_house_date: oh.open_house_date,
    open_house_hours: oh.open_house_hours,
    status: oh.status,
    profiles: {
      full_name: agent?.full_name ?? null,
      primary_color: agent?.primary_color ?? null,
      accent_color: agent?.accent_color ?? null,
    },
    sponsor: sponsorName ? { name: sponsorName } : null,
    customQuestions: signinQuestions,
  }
}
