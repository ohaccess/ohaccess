import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'

// Admin-only control for the permanent demo QR code. A printed sign encodes
// https://ohaccess.com/r/demo once; this endpoint repoints that code at
// whatever open house Dave just set up in front of a prospect. Reuses the
// existing short_urls table + /r/[code] redirect (including click counting).

const DEMO_CODE = 'demo'

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

export async function GET(request: Request) {
  const admin = await getAuthenticatedUser(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(admin.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabase
    .from('short_urls')
    .select('destination_url, clicks')
    .eq('code', DEMO_CODE)
    .maybeSingle()

  return NextResponse.json({
    shortUrl: `https://ohaccess.com/r/${DEMO_CODE}`,
    destinationUrl: data?.destination_url ?? null,
    clicks: data?.clicks ?? 0,
  })
}

export async function POST(request: Request) {
  const admin = await getAuthenticatedUser(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(admin.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const destinationUrl = typeof body?.destinationUrl === 'string' ? body.destinationUrl.trim() : ''

  if (!isHttpUrl(destinationUrl)) {
    return NextResponse.json({ error: 'A valid http(s) URL is required' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('short_urls')
    .select('code')
    .eq('code', DEMO_CODE)
    .maybeSingle()

  const { error } = existing
    ? await supabase
        .from('short_urls')
        .update({ destination_url: destinationUrl })
        .eq('code', DEMO_CODE)
    : await supabase.from('short_urls').insert({
        code: DEMO_CODE,
        destination_url: destinationUrl,
        agent_id: admin.id,
        url_type: 'demo',
      })

  if (error) {
    console.error('Demo redirect save failed', error)
    return NextResponse.json({ error: 'Could not save the demo redirect' }, { status: 500 })
  }

  console.log(`[admin] ${admin.email} pointed /r/${DEMO_CODE} at ${destinationUrl}`)
  return NextResponse.json({
    success: true,
    shortUrl: `https://ohaccess.com/r/${DEMO_CODE}`,
    destinationUrl,
  })
}
