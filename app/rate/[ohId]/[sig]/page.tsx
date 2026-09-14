import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { parseRatingScore } from '@/lib/report-rating'
import { verifyReportRating } from '@/lib/report-rating-link'
import RateClient from './RateClient'

// The page behind the five star links in the post-event report email. The
// tapped score arrives as ?score=N and is saved by RateClient once the page
// has loaded in a browser (not by this server render), so an email security
// scanner that fetches every link can't record a rating. The agent can change
// the stars or add a comment here.
//
// Reachable only with the signed link (lib/report-rating-link.ts); anything
// else is a plain 404. noindex, like /feedback.

export const metadata: Metadata = {
  title: 'Rate your open house day',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function RatePage({
  params,
  searchParams,
}: {
  params: Promise<{ ohId: string; sig: string }>
  searchParams: Promise<{ score?: string }>
}) {
  const { ohId, sig } = await params
  if (!UUID_RE.test(ohId) || !verifyReportRating(ohId, sig)) notFound()

  const { data: oh } = await supabase
    .from('open_houses')
    .select('id, property_address, street_address, open_house_date, open_house_hours')
    .eq('id', ohId)
    .maybeSingle()
  if (!oh) notFound()

  // Best-effort: a missing table or a hiccup just means no saved rating shown.
  const { data: existing } = await supabase
    .from('agent_report_ratings')
    .select('score, comment')
    .eq('open_house_id', ohId)
    .maybeSingle()

  const { score } = await searchParams

  return (
    <RateClient
      openHouseId={ohId}
      sig={sig}
      tappedScore={parseRatingScore(score)}
      savedScore={existing?.score ?? null}
      savedComment={existing?.comment ?? null}
      address={oh.property_address || oh.street_address || ''}
      dateLine={[oh.open_house_date, oh.open_house_hours].filter(Boolean).join(' · ')}
    />
  )
}
