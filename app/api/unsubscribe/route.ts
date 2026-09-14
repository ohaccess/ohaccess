import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { normalizeEmail } from '@/lib/invite-helpers'
import { isEmail } from '@/lib/register-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Email unsubscribe, three ways in behind one endpoint:
//   - { email }  anyone, from the plain /unsubscribe link in marketing
//     emails (no token: the person types their address). Lands in
//     email_opt_outs with source 'marketing_unsubscribe', which the drip,
//     weekend-games and invite senders all already honor.
//   - ?token=…  visitors, from open-house invite emails. Opting out is
//     GLOBAL — the address lands in email_opt_outs and is suppressed across
//     all agents, mirroring how SMS STOP works in sms_opt_outs.
//   - ?agent=…  agents, from the lifecycle ("drip") emails. The token is
//     profiles.drip_unsubscribe_token; opting out sets drip_opt_out_at,
//     which stops drip mail only — reminders, reports and billing email are
//     transactional and unaffected.
// Both tokens are the feedback_token pattern: random value, DB lookup, no
// crypto.
//
// POST only (never GET): email security scanners prefetch GET links, which
// would silently unsubscribe people. Two callers:
//   - the /unsubscribe page (JSON body { token } or { agent })
//   - mail clients via RFC 8058 List-Unsubscribe-Post (token in the query
//     string, form-encoded body we can ignore)
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'unsubscribe', 30, 3600)
    if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const params = new URL(request.url).searchParams
    let token = params.get('token') || ''
    let agentToken = params.get('agent') || ''
    let email = ''
    if (!token && !agentToken) {
      const body = await request.json().catch(() => null)
      token = typeof body?.token === 'string' ? body.token : ''
      agentToken = typeof body?.agent === 'string' ? body.agent : ''
      email = typeof body?.email === 'string' ? body.email : ''
    }
    token = token.trim()
    agentToken = agentToken.trim()

    if (!token && !agentToken && email) {
      const address = normalizeEmail(email)
      if (!isEmail(address)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
      // Idempotent: an address already on the list keeps its original time
      // and source.
      const { error } = await supabase
        .from('email_opt_outs')
        .upsert({ email: address, source: 'marketing_unsubscribe' }, { onConflict: 'email', ignoreDuplicates: true })
      if (error) {
        console.error('Marketing unsubscribe upsert failed', error)
        return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    if (agentToken) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('drip_unsubscribe_token', agentToken)
        .maybeSingle()
      if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      // Conditional so a second click keeps the original opt-out time.
      const { error } = await supabase
        .from('profiles')
        .update({ drip_opt_out_at: new Date().toISOString() })
        .eq('id', profile.id)
        .is('drip_opt_out_at', null)
      if (error) {
        console.error('Agent unsubscribe failed', error)
        return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

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
