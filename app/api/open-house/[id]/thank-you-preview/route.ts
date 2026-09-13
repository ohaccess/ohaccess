import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { buildThankYouPreview } from '@/lib/thank-you-preview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: the dashboard's "✉️ Visitor email" preview of the next-morning
// thank-you email for one open house (see lib/thank-you-preview). Owner-only,
// read-only; nothing is sent.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const preview = await buildThankYouPreview(id, user.id)
    // 404 for missing AND not-owned — don't confirm existence to non-owners.
    if (!preview) return NextResponse.json({ error: 'Open house not found' }, { status: 404 })
    return NextResponse.json(preview)
  } catch (err) {
    console.error('thank-you preview failed', err)
    return NextResponse.json({ error: 'Could not build the preview' }, { status: 500 })
  }
}
