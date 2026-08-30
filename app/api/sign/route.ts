import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { buildSignHtml } from '@/lib/sign-html'
import { onColor } from '@/lib/colors'
import { isHexColor } from '@/lib/register-helpers'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/sign?oh=<openHouseId>  → printable branded sign for that open
//   house's QR (encodes /register/<id>)
// GET /api/sign?code=<agentQrCode> → printable branded sign for the agent's
//   permanent QR (encodes /r/<code>)
//
// Server-rendered twin of the dashboard QR modal's "Print branded sign"
// button (same buildSignHtml), so email links can open the sign directly —
// no login/session, like /api/qrcode: everything on the sign is already
// public via the register page, and ids/codes are unguessable.
export async function GET(request: Request) {
  try {
    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'sign', 60, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const ohId = searchParams.get('oh')
    const code = searchParams.get('code')

    let agentId: string | null = null
    let qrTarget: string | null = null

    if (ohId && /^[0-9a-f-]{36}$/i.test(ohId)) {
      const { data: oh } = await supabase
        .from('open_houses')
        .select('id, agent_id')
        .eq('id', ohId)
        .maybeSingle()
      if (oh) {
        agentId = oh.agent_id
        qrTarget = `https://ohaccess.com/register/${oh.id}`
      }
    } else if (code && /^[a-zA-Z0-9]{1,16}$/.test(code)) {
      const { data: row } = await supabase
        .from('short_urls')
        .select('code, agent_id')
        .eq('code', code)
        .eq('url_type', 'agent_qr')
        .maybeSingle()
      if (row) {
        agentId = row.agent_id
        qrTarget = `https://ohaccess.com/r/${row.code}`
      }
    }

    if (!agentId || !qrTarget) {
      // Friendly page instead of raw JSON — these links live in reminder
      // emails, so a deleted open house (or a mail-app-mangled link) lands
      // a human here, not a machine.
      return new NextResponse(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>ohACCESS</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;color:#1d1d1f;display:flex;justify-content:center;padding:48px 24px;">
  <div style="max-width:420px;text-align:center;">
    <div style="font-size:28px;font-weight:200;letter-spacing:-0.5px;">oh<span style="font-weight:700;">ACCESS</span></div>
    <div style="font-size:16px;font-weight:700;margin-top:20px;">This sign link isn't available</div>
    <div style="font-size:14px;color:#6e6e73;margin-top:8px;line-height:1.6;">The open house it points to may have been removed. You can print a sign anytime from your dashboard — open your open house card and tap "QR Code".</div>
    <a href="https://www.ohaccess.com/dashboard" style="display:inline-block;margin-top:20px;background:#1d1d1f;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:600;">Go to dashboard</a>
  </div>
</body>
</html>`, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    const { data: agent } = await supabase
      .from('profiles')
      .select('primary_color, accent_color, logo_url, brokerage, brokerage_id')
      .eq('id', agentId)
      .maybeSingle()

    // Team/brokerage members inherit their team's branding, same as every
    // email and the register page.
    let brandColor = agent?.primary_color
    let brandLogo = agent?.logo_url
    if (agent?.brokerage_id) {
      const { data: brokerage } = await supabase
        .from('brokerages')
        .select('primary_color, logo_url')
        .eq('id', agent.brokerage_id)
        .maybeSingle()
      if (brokerage?.primary_color) brandColor = brokerage.primary_color
      if (brokerage?.logo_url) brandLogo = brokerage.logo_url
    }
    const primary = brandColor && isHexColor(brandColor) ? brandColor : '#1d1d1f'
    const accent = agent?.accent_color && isHexColor(agent.accent_color) ? agent.accent_color : '#1d1d1f'

    // Same QR rendering settings as /api/qrcode, inlined as a data URL.
    const dataUrl = await QRCode.toDataURL(qrTarget, {
      width: 512,
      margin: 2,
      color: { dark: '#1d1d1f', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    })

    const html = buildSignHtml({
      dataUrl,
      logoUrl: brandLogo || '',
      brokerageName: agent?.brokerage || '',
      primaryColor: primary,
      onPrimary: onColor(primary),
      accentColor: accent,
      onAccent: onColor(accent),
    })

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('Sign render error:', error)
    return NextResponse.json({ error: 'Failed to render sign' }, { status: 500 })
  }
}
