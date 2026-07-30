// Aggregate stats for the shareable seller report card (/report/<code>).
// Deliberately PII-free: the seller sees counts and timelines, never visitor
// names or contact info — visitors consented to sharing their details with
// the hosting agent, not the seller (and agents don't want sellers contacting
// buyers directly either).

import { TIMELINE_ORDER } from '@/lib/timeline'
import { normalizeCustomAnswers, normalizeCustomQuestions } from '@/lib/custom-questions'

export interface SellerReportStats {
  total: number
  // Timeline buckets in soonest-first order, zero-count buckets dropped, with
  // anything unrecognized collected under "Other".
  groups: { label: string; count: number }[]
  // Visitors in the two soonest buckets (buying within ~6 months) — the
  // headline number a seller cares about.
  soonCount: number
  // Scan → registration funnel, or null when the scan log can't be trusted
  // for this event (the qr_scans table is younger than some open houses, so a
  // scan count below the registration count means the log missed the event).
  funnel: { scans: number; registered: number } | null
  // Post-visit feedback, aggregated PII-free, or null when nobody answered.
  // avgRating is the mean of the 1–10 overall ratings (one decimal); price is
  // the count of each sentiment. responses = visitors who submitted feedback.
  feedback: {
    responses: number
    avgRating: number
    price: { high: number; reasonable: number; low: number }
  } | null
  // The agent's own custom questions, one entry per question that got at least
  // one answer. Answers are aggregated without any visitor identity attached.
  customQuestions: SellerReportQuestion[]
}

export interface SellerReportQuestion {
  id: string
  prompt: string
  responses: number
  // Multiple-choice questions aggregate to a count per option, in the agent's
  // configured order (zero-count options kept so the seller sees the full
  // scale). Answers recorded under an option that has since been reworded or
  // removed are appended after the live options. Null for free-text questions.
  choices: { label: string; count: number }[] | null
  // Free-text questions list the visitors' own words, anonymously, in the
  // order they signed in. Empty for choice questions.
  answers: string[]
}

const OTHER_LABEL = 'Other'

export interface SellerReportVisitor {
  purchasing_timeline: string | null
  feedback_rating?: number | null
  feedback_price?: string | null
  custom_answers?: unknown
}

export function buildSellerReportStats(
  visitors: SellerReportVisitor[],
  scanCount: number,
  // The agent's profiles.custom_questions jsonb, used only to learn each
  // question's type and option order. Answers snapshot their own prompt, so a
  // question deleted from Settings still reports under the prompt it was
  // asked with (as free text — its option list is gone).
  agentQuestions: unknown = null
): SellerReportStats {
  const total = visitors.length

  const groups: { label: string; count: number }[] = []
  for (const label of TIMELINE_ORDER) {
    const count = visitors.filter(v => v.purchasing_timeline === label).length
    if (count > 0) groups.push({ label, count })
  }
  const other = visitors.filter(
    v => !TIMELINE_ORDER.includes(v.purchasing_timeline || '')
  ).length
  if (other > 0) groups.push({ label: OTHER_LABEL, count: other })

  const soonCount = visitors.filter(v =>
    TIMELINE_ORDER.slice(0, 2).includes(v.purchasing_timeline || '')
  ).length

  const funnel =
    scanCount > 0 && scanCount >= total ? { scans: scanCount, registered: total } : null

  // A response requires both answers (the form submits them together), so a
  // numeric rating is a reliable marker of a completed feedback row.
  const rated = visitors
    .map(v => v.feedback_rating)
    .filter((r): r is number => typeof r === 'number')
  const feedback =
    rated.length > 0
      ? {
          responses: rated.length,
          avgRating: Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10,
          price: {
            high: visitors.filter(v => v.feedback_price === 'Too High').length,
            reasonable: visitors.filter(v => v.feedback_price === 'Reasonable').length,
            low: visitors.filter(v => v.feedback_price === 'Too Low').length,
          },
        }
      : null

  // Group custom answers by question id (never by prompt — a reworded prompt
  // must not split one question's answers into two buckets).
  const answered = new Map<string, { prompt: string; answers: string[] }>()
  for (const v of visitors) {
    for (const a of normalizeCustomAnswers(v.custom_answers)) {
      const entry = answered.get(a.id)
      if (entry) entry.answers.push(a.answer)
      else answered.set(a.id, { prompt: a.prompt, answers: [a.answer] })
    }
  }

  const liveQuestions = normalizeCustomQuestions(agentQuestions)
  const customQuestions: SellerReportQuestion[] = []
  const build = (id: string, entry: { prompt: string; answers: string[] }): SellerReportQuestion => {
    const live = liveQuestions.find(q => q.id === id)
    if (live?.type === 'choice') {
      const labels = [...live.options]
      for (const a of entry.answers) if (!labels.includes(a)) labels.push(a)
      return {
        id,
        prompt: live.prompt,
        responses: entry.answers.length,
        choices: labels.map(label => ({ label, count: entry.answers.filter(a => a === label).length })),
        answers: [],
      }
    }
    return { id, prompt: live?.prompt || entry.prompt, responses: entry.answers.length, choices: null, answers: entry.answers }
  }
  // Live questions first, in the agent's configured order; then any answered
  // questions that have since been deleted from Settings.
  for (const q of liveQuestions) {
    const entry = answered.get(q.id)
    if (entry) customQuestions.push(build(q.id, entry))
  }
  for (const [id, entry] of answered) {
    if (!liveQuestions.some(q => q.id === id)) customQuestions.push(build(id, entry))
  }

  return { total, groups, soonCount, funnel, feedback, customQuestions }
}
