import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getOrCreateSellerReportCode } from '@/lib/report-link'

// GET: the shareable seller-report link for one of the agent's open houses.
// Owner-only — the link itself is public once shared, but only the hosting
// agent can mint it.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'report-link', 60, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { id } = await params
    const { data: oh } = await supabase
      .from('open_houses')
      .select('id, agent_id')
      .eq('id', id)
      .maybeSingle()
    if (!oh || oh.agent_id !== user.id) {
      return NextResponse.json({ error: 'Open house not found' }, { status: 404 })
    }

    const code = await getOrCreateSellerReportCode(oh.id, user.id)
    if (!code) {
      return NextResponse.json({ error: 'Could not create report link' }, { status: 500 })
    }

    return NextResponse.json({ code, url: `https://www.ohaccess.com/report/${code}` })
  } catch (error) {
    console.error('Report link error:', error)
    return NextResponse.json({ error: 'Failed to load report link' }, { status: 500 })
  }
}
