// Meta Conversions API relay — the server-side copy of events the browser
// pixel already sends. iOS tracking prevention and ad blockers drop 20–40% of
// browser pixel events; this leg survives them. Each event carries the same
// event_id as its browser twin so Meta deduplicates instead of double-counting.
//
// Same privacy rules as lib/marketing-tags: inert until the env vars are set,
// and browsers sending Global Privacy Control get nothing sent on their behalf.
import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { META_SIGNUP_CUSTOM_DATA } from '@/lib/marketing-tags'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN
// From Events Manager → Test Events; routes events to the test view instead of
// production reporting. Remove from Vercel once dedup is verified.
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE

// Only events trackSignup() actually sends; anything else is rejected so the
// open endpoint can't be used to spray arbitrary conversions at the pixel.
const ALLOWED_EVENTS = new Set(['CompleteRegistration'])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Meta requires PII hashed with SHA-256, lowercased and trimmed first.
const hash = (value?: string | null) =>
  value ? crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex') : undefined

// Meta's click-id cookie format: fb.<subdomainIndex>.<setAtMs>.<fbclid>.
// Built here when the _fbc cookie is missing but the fbclid survived in a URL.
const fbclidFrom = (url?: string | null) => {
  if (!url) return undefined
  try {
    const id = new URL(url).searchParams.get('fbclid')
    return id && /^[A-Za-z0-9_-]{1,500}$/.test(id) ? id : undefined
  } catch {
    return undefined
  }
}

export async function POST(request: NextRequest) {
  try {
    // Unconfigured is the normal state until the IDs are pasted into Vercel —
    // report success so the client never logs errors for a deliberate no-op.
    if (!PIXEL_ID || !ACCESS_TOKEN) {
      return NextResponse.json({ ok: true, skipped: 'not configured' })
    }
    if (request.headers.get('sec-gpc') === '1') {
      return NextResponse.json({ ok: true, skipped: 'gpc' })
    }

    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'meta-event', 10, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { eventName, eventId, email, userId, sourceUrl } = await request.json()
    if (!ALLOWED_EVENTS.has(eventName) || typeof eventId !== 'string' || !eventId) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    // At-most-once per user: the first request claims the user's row (and
    // records which event_id won); a repeat signup submit — same person
    // resending the confirmation email — hits the primary key and is dropped
    // instead of double-counting the conversion. Any other insert error fails
    // open: better an occasional duplicate than silently losing conversions
    // (e.g. before migration 049 has run).
    const externalId = typeof userId === 'string' && UUID_RE.test(userId) ? userId : undefined
    if (externalId) {
      const { error } = await supabaseAdmin
        .from('meta_registration_events')
        .insert({ user_id: externalId, event_id: eventId })
      if (error?.code === '23505') {
        return NextResponse.json({ ok: true, skipped: 'duplicate' })
      }
      if (error) console.error('[meta-capi] event_id persist failed', error)
    }

    // _fbp/_fbc are Meta's attribution cookies (set by the browser pixel, plus
    // proxy.ts writing _fbc server-side on fbclid landings). Passing them
    // through is what lets Meta match this server event back to the ad click
    // that drove it. When the cookie is missing but the fbclid is still in the
    // page URL (or referrer), rebuild _fbc in the same format the pixel uses.
    const fbp = request.cookies.get('_fbp')?.value
    let fbc = request.cookies.get('_fbc')?.value
    if (!fbc) {
      const clickId =
        fbclidFrom(typeof sourceUrl === 'string' ? sourceUrl : undefined) ??
        fbclidFrom(request.headers.get('referer'))
      if (clickId) fbc = `fb.1.${Date.now()}.${clickId}`
    }

    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId, // must match the browser event's eventID for dedup
          action_source: 'website',
          event_source_url: typeof sourceUrl === 'string' ? sourceUrl.slice(0, 1024) : undefined,
          user_data: {
            em: hash(typeof email === 'string' ? email : undefined),
            // Hashing external_id is optional for Meta, but fbevents.js hashes
            // its advanced-matching copy in the browser — hash here too so the
            // two legs carry the same digest.
            external_id: externalId ? [hash(externalId)] : undefined,
            client_ip_address: ip === 'unknown' ? undefined : ip,
            client_user_agent: request.headers.get('user-agent') ?? undefined,
            fbp,
            fbc,
          },
          custom_data: { ...META_SIGNUP_CUSTOM_DATA },
        },
      ],
      ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
    }

    const res = await fetch(
      `https://graph.facebook.com/v23.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    if (!res.ok) {
      console.error('[meta-capi] send failed', await res.json().catch(() => res.status))
      return NextResponse.json({ ok: false }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[meta-capi] error', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
