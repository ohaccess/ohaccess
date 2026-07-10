import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { buildMapPayload, validShareCode } from '@/lib/map-data'

// GET: open-house map data for the secret-link share page (/map/[code]).
// No login — access is the unguessable code itself (MAP_SHARE_CODE env var;
// with it unset this endpoint is a hard 404). Rate limited per IP before the
// code check so the code can't be brute-forced.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const ip = getClientIp(request)
  const limit = await checkRateLimit(`ip:${ip}`, 'map-share', 60, 3600)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { code } = await params
  if (!validShareCode(code)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const payload = await buildMapPayload()
  if (!payload) {
    return NextResponse.json({ error: 'Failed to load open houses' }, { status: 500 })
  }

  return NextResponse.json({ ...payload, generatedAt: new Date().toISOString() })
}
