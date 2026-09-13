import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { buildVisitorEmailPreviews } from '@/lib/visitor-email-previews'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: the dashboard's "✉️ Visitor emails" preview — the codeword, thank-you
// and invite emails for one open house (see lib/visitor-email-previews).
// Owner-only, read-only; nothing is sent.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const previews = await buildVisitorEmailPreviews(id, user.id)
    // 404 for missing AND not-owned — don't confirm existence to non-owners.
    if (!previews) return NextResponse.json({ error: 'Open house not found' }, { status: 404 })
    return NextResponse.json(previews)
  } catch (err) {
    console.error('visitor emails preview failed', err)
    return NextResponse.json({ error: 'Could not build the preview' }, { status: 500 })
  }
}
