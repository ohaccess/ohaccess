import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/auth'
import { getOrCreateReferralCode, referralShortUrl } from '@/lib/referral-code'

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

    const code = await getOrCreateReferralCode(supabase, user.id)
    if (!code) {
      return NextResponse.json({ error: 'Could not create referral link' }, { status: 500 })
    }

    return NextResponse.json({
      eligible: true,
      code,
      shortUrl: referralShortUrl(code),
    })
  } catch (error) {
    console.error('Referral link error:', error)
    return NextResponse.json({ error: 'Failed to load referral link' }, { status: 500 })
  }
}
