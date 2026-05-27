import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { SUBSCRIBER_TERMS_VERSION, PRIVACY_POLICY_VERSION } from '@/lib/legal-versions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Records that a particular email agreed to the current subscriber terms +
// privacy policy versions at signup time. Captures IP and user-agent so the
// audit trail is independently meaningful (not just trust-the-client).
//
// No auth required: the signup form posts here before the auth.users row
// exists. Rate-limited per IP to prevent flood.
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'legal-accept', 30, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

    const { error } = await supabase.from('terms_acceptances').insert({
      email,
      subscriber_terms_version: SUBSCRIBER_TERMS_VERSION,
      privacy_policy_version: PRIVACY_POLICY_VERSION,
      ip_address: ip,
      user_agent: userAgent,
    })

    if (error) {
      console.error('terms_acceptances insert failed', error)
      return NextResponse.json({ error: 'Failed to record acceptance' }, { status: 500 })
    }

    return NextResponse.json({ recorded: true })
  } catch (err) {
    console.error('Legal accept error:', err)
    return NextResponse.json({ error: 'Failed to record acceptance' }, { status: 500 })
  }
}
