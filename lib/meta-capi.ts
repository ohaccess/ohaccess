// Meta Conversions API, server side. The one place that talks to
// graph.facebook.com, shared by /api/meta-event (the relay for events the
// browser pixel also sends) and the Stripe webhook (the Purchase event, which
// is sent from here first because the buyer may never come back to the
// dashboard where the browser leg fires).
//
// Same privacy rules as lib/marketing-tags: inert until the env vars are set.
// GPC is honored by the callers, which are the only ones that see the browser.
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { META_FIRST_OPEN_HOUSE_CUSTOM_DATA, META_SIGNUP_CUSTOM_DATA } from '@/lib/marketing-tags'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN
// From Events Manager → Test Events; routes events to the test view instead of
// production reporting. Remove from Vercel once dedup is verified.
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE

export function isMetaCapiConfigured(): boolean {
  return !!(PIXEL_ID && ACCESS_TOKEN)
}

// Events the browser relay (/api/meta-event) accepts, with the custom_data
// each carries. Anything else is rejected so the open endpoint can't be used
// to spray arbitrary conversions at the pixel. Purchase is deliberately NOT
// here: it is sent by the Stripe webhook with Stripe's numbers, never from
// the browser's say-so.
export const RELAYED_META_EVENTS: Record<string, Record<string, unknown>> = {
  CompleteRegistration: { ...META_SIGNUP_CUSTOM_DATA },
  FirstOpenHouse: { ...META_FIRST_OPEN_HOUSE_CUSTOM_DATA },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

// Meta requires PII hashed with SHA-256, lowercased and trimmed first.
export const hashForMeta = (value?: string | null) =>
  value ? crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex') : undefined

// Meta's click-id cookie format: fb.<subdomainIndex>.<setAtMs>.<fbclid>.
// Built when the _fbc cookie is missing but the fbclid survived in a URL.
export const fbclidFrom = (url?: string | null) => {
  if (!url) return undefined
  try {
    const id = new URL(url).searchParams.get('fbclid')
    return id && /^[A-Za-z0-9_-]{1,500}$/.test(id) ? id : undefined
  } catch {
    return undefined
  }
}

// At-most-once per (user, event): the first call claims the row (recording
// which event_id won); a repeat for the same user and event, such as a second
// signup-form submit or a reload inside the browser's freshness window, hits
// the primary key and is reported as a duplicate so the caller skips it. Any
// other error fails open: better an occasional duplicate than silently losing
// conversions (e.g. before migration 059 has run).
export async function claimMetaEvent(
  userId: string,
  eventName: string,
  eventId: string
): Promise<'claimed' | 'duplicate'> {
  const { error } = await supabaseAdmin
    .from('meta_conversion_events')
    .insert({ user_id: userId, event_name: eventName, event_id: eventId })
  if (error?.code === '23505') return 'duplicate'
  if (error) console.error('[meta-capi] event ledger insert failed', error)
  return 'claimed'
}

export type MetaEventInput = {
  eventName: string
  eventId: string           // must match the browser event's eventID for dedup
  email?: string | null
  userId?: string | null    // Supabase auth id → Meta external_id (hashed)
  sourceUrl?: string | null
  ip?: string | null
  userAgent?: string | null
  fbp?: string | null       // Meta's browser-id cookie (_fbp)
  fbc?: string | null       // Meta's click-id cookie (_fbc)
  customData?: Record<string, unknown>
}

// Sends one event. Resolves true when Meta accepted it, false otherwise (the
// failure is logged; callers never let tracking break the real work).
export async function sendMetaEvent(e: MetaEventInput): Promise<boolean> {
  if (!PIXEL_ID || !ACCESS_TOKEN) return false
  const payload = {
    data: [
      {
        event_name: e.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: e.eventId,
        action_source: 'website',
        event_source_url: e.sourceUrl ? e.sourceUrl.slice(0, 1024) : undefined,
        user_data: {
          em: hashForMeta(e.email ?? undefined),
          // Hashing external_id is optional for Meta, but fbevents.js hashes
          // its advanced-matching copy in the browser — hash here too so the
          // two legs carry the same digest.
          external_id: isUuid(e.userId) ? [hashForMeta(e.userId)] : undefined,
          client_ip_address: e.ip && e.ip !== 'unknown' ? e.ip : undefined,
          client_user_agent: e.userAgent ?? undefined,
          fbp: e.fbp ?? undefined,
          fbc: e.fbc ?? undefined,
        },
        custom_data: e.customData ?? {},
      },
    ],
    ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v23.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    )
    if (!res.ok) {
      console.error('[meta-capi] send failed', e.eventName, await res.json().catch(() => res.status))
      return false
    }
    return true
  } catch (err) {
    console.error('[meta-capi] send error', e.eventName, err)
    return false
  }
}
