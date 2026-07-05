import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'

// Admin-only control for the permanent demo QR codes. Printed signs encode
// https://ohaccess.com/r/<code> once (one sign per code); this endpoint
// repoints each code at whatever open house Dave just set up in front of a
// prospect — several signs can be out at different open houses on the same
// day. Reuses the existing short_urls table + /r/[code] redirect (including
// click counting).

const DEMO_CODES = ['demo', 'demo1', 'demo2', 'demo3']

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

export async function GET(request: Request) {
  const admin = await getAuthenticatedUser(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(admin.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabase
    .from('short_urls')
    .select('code, destination_url, clicks')
    .in('code', DEMO_CODES)

  const byCode = new Map((data || []).map((r) => [r.code, r]))
  return NextResponse.json({
    codes: DEMO_CODES.map((code) => ({
      code,
      shortUrl: `https://ohaccess.com/r/${code}`,
      destinationUrl: byCode.get(code)?.destination_url ?? null,
      clicks: byCode.get(code)?.clicks ?? 0,
    })),
  })
}

export async function POST(request: Request) {
  const admin = await getAuthenticatedUser(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(admin.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const code = typeof body?.code === 'string' ? body.code : 'demo'
  const destinationUrl = typeof body?.destinationUrl === 'string' ? body.destinationUrl.trim() : ''

  if (!DEMO_CODES.includes(code)) {
    return NextResponse.json({ error: 'Unknown demo code' }, { status: 400 })
  }
  if (!isHttpUrl(destinationUrl)) {
    return NextResponse.json({ error: 'A valid http(s) URL is required' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('short_urls')
    .select('code')
    .eq('code', code)
    .maybeSingle()

  const { error } = existing
    ? await supabase
        .from('short_urls')
        .update({ destination_url: destinationUrl })
        .eq('code', code)
    : await supabase.from('short_urls').insert({
        code,
        destination_url: destinationUrl,
        agent_id: admin.id,
        url_type: 'demo',
      })

  if (error) {
    console.error('Demo redirect save failed', error)
    return NextResponse.json({ error: 'Could not save the demo redirect' }, { status: 500 })
  }

  console.log(`[admin] ${admin.email} pointed /r/${code} at ${destinationUrl}`)
  return NextResponse.json({
    success: true,
    code,
    shortUrl: `https://ohaccess.com/r/${code}`,
    destinationUrl,
  })
}
