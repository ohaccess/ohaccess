import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { isLang } from '@/lib/register-i18n'
import { normalizeCustomQuestions, questionsForSurface } from '@/lib/custom-questions'
import FeedbackClient from './FeedbackClient'

// The page behind the "share your feedback" button in the next-morning
// thank-you email. Same two questions (plus the agent's own success-screen
// questions) as the sign-in success card, for the visitors who pocketed the
// phone at the codeword and never scrolled back — submits to /api/feedback
// with the same one-time token, so write-once and the seller-report
// aggregation are untouched.
//
// Reachable only with the visitor's own unguessable feedback_token (the
// UUID /api/register minted for their row); anything else is a plain 404.
// Service-role read, safe fields only. noindex, like /checkin.

export const metadata: Metadata = {
  title: 'How was the home?',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!UUID_RE.test(token)) notFound()

  const { data: visitor } = await supabase
    .from('visitors')
    .select('id, lang, feedback_submitted_at, open_house_id, agent_id')
    .eq('feedback_token', token)
    .maybeSingle()
  if (!visitor?.open_house_id) notFound()

  const [{ data: oh }, { data: agent }] = await Promise.all([
    supabase
      .from('open_houses')
      .select('property_address, street_address, open_house_date, open_house_hours')
      .eq('id', visitor.open_house_id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('full_name, brokerage, primary_color, accent_color, custom_questions')
      .eq('id', visitor.agent_id)
      .maybeSingle(),
  ])
  if (!oh) notFound()

  // Current questions, not a snapshot — same as /api/feedback, which re-reads
  // them from the profile when validating the answers.
  const successQuestions = questionsForSurface(
    normalizeCustomQuestions(agent?.custom_questions),
    'success'
  )

  return (
    <FeedbackClient
      token={token}
      lang={isLang(visitor.lang) ? visitor.lang : 'en'}
      alreadyDone={!!visitor.feedback_submitted_at}
      address={oh.property_address || oh.street_address || ''}
      dateLine={[oh.open_house_date, oh.open_house_hours].filter(Boolean).join(' · ')}
      agentName={agent?.full_name || null}
      brokerage={agent?.brokerage || null}
      primaryColor={agent?.primary_color || null}
      accentColor={agent?.accent_color || null}
      questions={successQuestions}
    />
  )
}
