import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { FEEDBACK_PRICE_VALUES } from '@/lib/register-i18n'
import {
  normalizeCustomQuestions,
  questionsForSurface,
  buildCustomAnswers,
  mergeCustomAnswers,
} from '@/lib/custom-questions'

// Post-visit feedback submitted from the sign-in success screen (no auth — the
// visitor isn't logged in). The visitor's browser holds a one-time
// feedback_token handed back by /api/register; we look the visitor up by that
// token and write the rating + price exactly once.
//
// Security: the token is unguessable and scoped to a single visitor row; the
// write is refused if feedback was already submitted (write-once) and if the
// values are out of range. Uses the service-role client because the anonymous
// visitor can't satisfy the owner-scoped RLS policy on visitors.

export async function POST(request: Request) {
  try {
    // Light per-IP throttle — same table/pattern as registration.
    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'feedback', 30, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const token = typeof body?.token === 'string' ? body.token : ''
    const rating = Number(body?.rating)
    const price = typeof body?.price === 'string' ? body.price : ''

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }
    // Rating is an integer 1–10; price is one of the canonical English values.
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 })
    }
    if (!(FEEDBACK_PRICE_VALUES as readonly string[]).includes(price)) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    }

    // Look up the visitor by its one-time token; only write if feedback hasn't
    // already been submitted (write-once).
    const { data: visitor } = await supabase
      .from('visitors')
      .select('id, agent_id, feedback_submitted_at, custom_answers')
      .eq('feedback_token', token)
      .maybeSingle()

    if (!visitor) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (visitor.feedback_submitted_at) {
      // Idempotent: treat a repeat as success rather than an error.
      return NextResponse.json({ success: true, alreadySubmitted: true })
    }

    // Answers to the agent's own success-screen questions ride along with the
    // built-in feedback (one screen, one Submit). Questions are re-read from
    // the agent's profile rather than trusted from the client, and merged onto
    // any sign-in answer already on the row instead of overwriting it.
    const { data: agent } = await supabase
      .from('profiles')
      .select('custom_questions')
      .eq('id', visitor.agent_id)
      .maybeSingle()
    const successQuestions = questionsForSurface(
      normalizeCustomQuestions(agent?.custom_questions),
      'success'
    )
    const newAnswers = buildCustomAnswers(successQuestions, body?.customAnswers)
    const mergedAnswers = mergeCustomAnswers(visitor.custom_answers, newAnswers)

    const { error } = await supabase
      .from('visitors')
      .update({
        feedback_rating: rating,
        feedback_price: price,
        feedback_submitted_at: new Date().toISOString(),
        ...(newAnswers.length > 0 ? { custom_answers: mergedAnswers } : {}),
      })
      .eq('feedback_token', token)
      .is('feedback_submitted_at', null)

    if (error) {
      return NextResponse.json({ error: 'Could not save feedback' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Feedback error:', error)
    return NextResponse.json({ error: 'Feedback failed. Please try again.' }, { status: 500 })
  }
}
