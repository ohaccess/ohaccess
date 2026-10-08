// Meta Conversions API relay — the server-side copy of events the browser
// pixel also sends (CompleteRegistration at signup, FirstOpenHouse on the
// dashboard). iOS tracking prevention and ad blockers drop 20–40% of browser
// pixel events; this leg survives them. Each event carries the same event_id
// as its browser twin so Meta deduplicates instead of double-counting.
//
// Same privacy rules as lib/marketing-tags: inert until the env vars are set,
// and browsers sending Global Privacy Control get nothing sent on their behalf.
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { RELAYED_META_EVENTS, claimMetaEvent, fbclidFrom, isMetaCapiConfigured, isUuid, sendMetaEvent } from '@/lib/meta-capi'

export async function POST(request: NextRequest) {
  try {
    // Unconfigured is the normal state until the IDs are pasted into Vercel —
    // report success so the client never logs errors for a deliberate no-op.
    if (!isMetaCapiConfigured()) {
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
    const customData = typeof eventName === 'string' ? RELAYED_META_EVENTS[eventName] : undefined
    if (!customData || typeof eventId !== 'string' || !eventId) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    // At-most-once per user and event (lib/meta-capi claimMetaEvent).
    const externalId = isUuid(userId) ? userId : undefined
    if (externalId && (await claimMetaEvent(externalId, eventName, eventId)) === 'duplicate') {
      return NextResponse.json({ ok: true, skipped: 'duplicate' })
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

    const sent = await sendMetaEvent({
      eventName,
      eventId,
      email: typeof email === 'string' ? email : undefined,
      userId: externalId,
      sourceUrl: typeof sourceUrl === 'string' ? sourceUrl : undefined,
      ip,
      userAgent: request.headers.get('user-agent'),
      fbp,
      fbc,
      customData,
    })
    if (!sent) return NextResponse.json({ ok: false }, { status: 502 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[meta-capi] error', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
