import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'
import { buildMapPayload, shareUrl } from '@/lib/map-data'

// GET: the open-house map data for the admin Map tab, plus the shareable
// secret-link URL (admin-only response, so the secret is safe to include).
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await buildMapPayload()
  if (!payload) {
    return NextResponse.json({ error: 'Failed to load open houses' }, { status: 500 })
  }

  return NextResponse.json({ ...payload, shareUrl: shareUrl(), generatedAt: new Date().toISOString() })
}
