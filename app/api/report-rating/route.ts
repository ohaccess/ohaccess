import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { parseRatingScore, cleanRatingComment } from '@/lib/report-rating'
import { verifyReportRating } from '@/lib/report-rating-link'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST: save an agent's rating of an open house day, sent by the /rate page
// behind the star links in the post-event report email. No login: the signed
// link is the permission (lib/report-rating-link.ts). One row per open house;
// a later rating overwrites the score, and the comment is only replaced when
// the request includes one.
export async function POST(request: Request) {
  const limit = await checkRateLimit(`ip:${getClientIp(request)}`, 'report-rating', 30, 3600)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many tries. Please try again in a few minutes.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const openHouseId = typeof body?.openHouseId === 'string' ? body.openHouseId : ''
  const sig = typeof body?.sig === 'string' ? body.sig : ''
  if (!UUID_RE.test(openHouseId) || !verifyReportRating(openHouseId, sig)) {
    return NextResponse.json({ error: 'This rating link isn’t valid.' }, { status: 404 })
  }

  const score = parseRatingScore(body?.score)
  if (score === null) return NextResponse.json({ error: 'Please pick 1 to 5 stars.' }, { status: 400 })

  const hasComment = Object.prototype.hasOwnProperty.call(body, 'comment')
  const cleaned = cleanRatingComment(hasComment ? body.comment : undefined)
  if (!cleaned.ok) return NextResponse.json({ error: 'That comment is too long.' }, { status: 400 })

  const { data: oh } = await supabase
    .from('open_houses')
    .select('id, agent_id')
    .eq('id', openHouseId)
    .maybeSingle()
  if (!oh) return NextResponse.json({ error: 'This open house is no longer available.' }, { status: 404 })

  const { error } = await supabase
    .from('agent_report_ratings')
    .upsert(
      {
        open_house_id: oh.id,
        agent_id: oh.agent_id,
        score,
        ...(hasComment ? { comment: cleaned.comment } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'open_house_id' }
    )
  if (error) {
    console.error('Report rating save failed', error)
    return NextResponse.json({ error: 'Couldn’t save your rating. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, score })
}
