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

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN
// From Events Manager → Test Events; routes events to the test view instead of
// production reporting. Remove from Vercel once dedup is verified.
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE

// Only events trackSignup() actually sends; anything else is rejected so the
// open endpoint can't be used to spray arbitrary conversions at the pixel.
const ALLOWED_EVENTS = new Set(['CompleteRegistration'])

// Meta requires PII hashed with SHA-256, lowercased and trimmed first.
const hash = (value?: string | null) =>
  value ? crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex') : undefined

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

    const { eventName, eventId, email, sourceUrl } = await request.json()
    if (!ALLOWED_EVENTS.has(eventName) || typeof eventId !== 'string' || !eventId) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    // _fbp/_fbc are Meta's attribution cookies (set by the browser pixel).
    // Passing them through is what lets Meta match this server event back to
    // the ad click that drove it.
    const fbp = request.cookies.get('_fbp')?.value
    const fbc = request.cookies.get('_fbc')?.value

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
            client_ip_address: ip === 'unknown' ? undefined : ip,
            client_user_agent: request.headers.get('user-agent') ?? undefined,
            fbp,
            fbc,
          },
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
