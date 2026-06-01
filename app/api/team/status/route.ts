import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { getBrokerageContext } from '@/lib/team'

// GET: lightweight billing-health check for the CURRENT user's team. Any team
// member (not just admins) can call it — it returns no roster, just enough to
// drive the "your team's payment needs attention" banner. Returns
// { hasTeam: false } for solo agents (incl. ex-members who were unlinked when
// their team lapsed — they then see the normal plan options instead).
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getBrokerageContext(user.id)
  if (!ctx) return NextResponse.json({ hasTeam: false })

  return NextResponse.json({
    hasTeam: true,
    name: ctx.name,
    tier: ctx.tier,
    isAdmin: ctx.isAdmin,
    subscription_status: ctx.subscriptionStatus,
  })
}
