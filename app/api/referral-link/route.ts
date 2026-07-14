import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/auth'
import { generateCode } from '@/lib/register-helpers'

// GET: the agent's personal referral link — one stable /r/<code> per agent,
// created lazily on first request (mirrors /api/agent-qr). The short link
// redirects to the landing page with ?ref=<code>, which RefCapture stamps
// onto any signup, so referred accounts show up under this code in
// /admin/sources. Open to EVERY signed-in agent (Dave's call, 2026-07):
// tracking is decoupled from reward. Free/team agents can share and their
// referrals accrue under their code; the renewal-credit reward itself is
// still awarded manually via /api/admin/gift and only pays out against a
// self-paid Pro plan.
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'referral-link', 60, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { data: existing } = await supabase
      .from('short_urls')
      .select('code')
      .eq('agent_id', user.id)
      .eq('url_type', 'referral')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        eligible: true,
        code: existing.code,
        shortUrl: `https://ohaccess.com/r/${existing.code}`,
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

    // The landing page's RefCapture reads ?ref= and stamps it on signups, so
    // the short code doubles as the referral_source value in /admin/sources.
    const { data: created, error } = await supabase
      .from('short_urls')
      .insert({
        code,
        destination_url: `https://ohaccess.com/?ref=${code}`,
        agent_id: user.id,
        url_type: 'referral',
      })
      .select('code')
      .single()

    if (error || !created) {
      return NextResponse.json({ error: error?.message || 'Could not create referral link' }, { status: 500 })
    }

    return NextResponse.json({
      eligible: true,
      code: created.code,
      shortUrl: `https://ohaccess.com/r/${created.code}`,
    })
  } catch (error) {
    console.error('Referral link error:', error)
    return NextResponse.json({ error: 'Failed to load referral link' }, { status: 500 })
  }
}
