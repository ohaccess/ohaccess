import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/auth'
import { generateCode } from '@/lib/register-helpers'

// GET: the agent's permanent QR link — one stable /r/<code> per agent that the
// redirect page resolves dynamically to their next (or latest) open house.
// Created lazily on first request, then returned as-is forever so a printed
// QR sign never goes stale.
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'agent-qr', 60, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { data: existing } = await supabase
      .from('short_urls')
      .select('code')
      .eq('agent_id', user.id)
      .eq('url_type', 'agent_qr')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        code: existing.code,
        shortUrl: `https://ohaccess.com/r/${existing.code}`
      })
    }

    let code: string | null = null
    for (let i = 0; i < 10; i++) {
      const candidate = generateCode()
      const { data } = await supabase
        .from('short_urls')
        .select('code')
        .eq('code', candidate)
        .maybeSingle()
      if (!data) { code = candidate; break }
    }
    if (!code) {
      return NextResponse.json({ error: 'Could not generate a unique code' }, { status: 500 })
    }

    // destination_url is only the last-resort fallback; /r/[code] resolves
    // agent_qr rows against the agent's open houses at scan time.
    const { data: created, error } = await supabase
      .from('short_urls')
      .insert({
        code,
        destination_url: 'https://ohaccess.com',
        agent_id: user.id,
        url_type: 'agent_qr'
      })
      .select('code')
      .single()

    if (error || !created) {
      return NextResponse.json({ error: error?.message || 'Could not create QR link' }, { status: 500 })
    }

    return NextResponse.json({
      code: created.code,
      shortUrl: `https://ohaccess.com/r/${created.code}`
    })
  } catch (error) {
    console.error('Agent QR error:', error)
    return NextResponse.json({ error: 'Failed to load QR link' }, { status: 500 })
  }
}
