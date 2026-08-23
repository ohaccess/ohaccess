import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Per-open-house numbers for the dashboard's open house cards: sign-ins,
// average After Tour rating, majority price answer, 0–3 month buyers, and
// invite emails sent. Aggregated here rather than in the browser because
// visitor_invites is service-role only (035), and so the payload stays a
// handful of numbers per open house no matter how many visitors are behind
// them. Owner-scoped: everything is filtered to the authenticated agent.

// Matches '0–3 Months' and the hyphen variant on any legacy rows.
const HOT_TIMELINE = /^0\s*[–-]\s*3/

// Ties go to the more cautionary answer — a 1–1 split between "Too High"
// and "Reasonable" is a price conversation, not reassurance.
const PRICE_ORDER = ['Too High', 'Reasonable', 'Too Low'] as const

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: visitors, error: vErr }, { data: invites, error: iErr }] = await Promise.all([
    supabase
      .from('visitors')
      .select('open_house_id, feedback_rating, feedback_price, purchasing_timeline')
      .eq('agent_id', user.id)
      .limit(10000),
    supabase
      .from('visitor_invites')
      .select('open_house_id')
      .eq('agent_id', user.id)
      .limit(10000),
  ])
  if (vErr || iErr) {
    console.error('oh-stats query failed', vErr || iErr)
    return NextResponse.json({ error: 'Could not load stats' }, { status: 500 })
  }

  type Working = {
    visitors: number
    ratingSum: number
    ratingCount: number
    prices: Record<string, number>
    hotBuyers: number
    invites: number
  }
  const working = new Map<string, Working>()
  const get = (ohId: string): Working => {
    let w = working.get(ohId)
    if (!w) {
      w = { visitors: 0, ratingSum: 0, ratingCount: 0, prices: {}, hotBuyers: 0, invites: 0 }
      working.set(ohId, w)
    }
    return w
  }

  for (const v of visitors ?? []) {
    if (!v.open_house_id) continue
    const w = get(v.open_house_id)
    w.visitors++
    if (typeof v.feedback_rating === 'number') {
      w.ratingSum += v.feedback_rating
      w.ratingCount++
    }
    if (v.feedback_price) w.prices[v.feedback_price] = (w.prices[v.feedback_price] || 0) + 1
    if (v.purchasing_timeline && HOT_TIMELINE.test(v.purchasing_timeline)) w.hotBuyers++
  }
  for (const inv of invites ?? []) {
    if (inv.open_house_id) get(inv.open_house_id).invites++
  }

  const stats: Record<string, {
    visitors: number
    ratingAvg: number | null
    ratingCount: number
    priceVerdict: string | null
    hotBuyers: number
    invites: number
  }> = {}
  for (const [ohId, w] of working) {
    let priceVerdict: string | null = null
    let best = 0
    for (const p of PRICE_ORDER) {
      if ((w.prices[p] || 0) > best) { best = w.prices[p]; priceVerdict = p }
    }
    stats[ohId] = {
      visitors: w.visitors,
      ratingAvg: w.ratingCount ? Math.round((w.ratingSum / w.ratingCount) * 10) / 10 : null,
      ratingCount: w.ratingCount,
      priceVerdict,
      hotBuyers: w.hotBuyers,
      invites: w.invites,
    }
  }

  return NextResponse.json({ stats })
}
