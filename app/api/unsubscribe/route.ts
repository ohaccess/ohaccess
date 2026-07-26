import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// One-click email unsubscribe for open-house invites. The token is the
// opaque per-invite unsubscribe_token (feedback_token pattern: random value,
// DB lookup, no crypto). Opting out is GLOBAL — the address lands in
// email_opt_outs and is suppressed across all agents, mirroring how SMS
// STOP works in sms_opt_outs.
//
// POST only (never GET): email security scanners prefetch GET links, which
// would silently unsubscribe people. Two callers:
//   - the /unsubscribe page (JSON body { token })
//   - mail clients via RFC 8058 List-Unsubscribe-Post (token in the query
//     string, form-encoded body we can ignore)
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'unsubscribe', 30, 3600)
    if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    let token = new URL(request.url).searchParams.get('token') || ''
    if (!token) {
      const body = await request.json().catch(() => null)
      token = typeof body?.token === 'string' ? body.token : ''
    }
    token = token.trim()
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

    const { data: invite } = await supabase
      .from('visitor_invites')
      .select('email')
      .eq('unsubscribe_token', token)
      .maybeSingle()
    if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Idempotent: clicking twice is fine.
    const { error } = await supabase
      .from('email_opt_outs')
      .upsert({ email: invite.email, source: 'invite_unsubscribe' }, { onConflict: 'email', ignoreDuplicates: true })
    if (error) {
      console.error('Unsubscribe upsert failed', error)
      return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
  }
}
