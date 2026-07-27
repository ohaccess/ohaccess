// Agent-defined questions layered on top of the fixed sign-in fields and the
// two fixed post-visit feedback questions.
//
// Pure module (no Supabase/Twilio/Resend imports) so it can be unit-tested in
// isolation, like lib/register-helpers.
//
// Two surfaces, deliberately capped at different sizes:
//   'signin'  — asked on the registration form, BEFORE the visitor gets their
//               codeword. This form is an entry gate, so exactly one extra
//               question is allowed and it is never required: a visitor who
//               can't get past a question can't get into the house.
//   'success' — asked on the confirmation screen alongside the built-in rating
//               and price questions. No conversion risk (they're already
//               verified), so two are allowed.
//
// The built-in feedback questions (visitors.feedback_rating / feedback_price)
// are NOT represented here. They stay fixed because lib/seller-report.ts
// aggregates them by name, and an agent deleting them would silently break
// their own seller report.

export type CustomQuestionType = 'text' | 'choice'
export type CustomQuestionSurface = 'signin' | 'success'

export type CustomQuestion = {
  id: string
  prompt: string
  type: CustomQuestionType
  options: string[]
  surface: CustomQuestionSurface
}

// What lands on the visitor row. The prompt is SNAPSHOTTED next to the answer
// rather than looked up from profiles at read time, so an agent editing or
// deleting a question in Settings can never relabel or orphan a past visitor's
// answer. Same reasoning as visitors.disclosures_sent and sponsor_name.
export type CustomAnswer = { id: string; prompt: string; answer: string }

export const MAX_SIGNIN_QUESTIONS = 1
export const MAX_SUCCESS_QUESTIONS = 2
export const MAX_CHOICE_OPTIONS = 4
export const MAX_PROMPT_LENGTH = 160
export const MAX_OPTION_LENGTH = 60
export const MAX_ANSWER_LENGTH = 500

const SURFACE_LIMITS: Record<CustomQuestionSurface, number> = {
  signin: MAX_SIGNIN_QUESTIONS,
  success: MAX_SUCCESS_QUESTIONS,
}

// Coerce whatever is sitting in profiles.custom_questions into a clean list.
// Malformed entries are dropped rather than thrown: a bad row in settings must
// never be able to break a visitor's sign-in. Caps are enforced here, not just
// in the settings UI, because the stored jsonb is the only thing the register
// route trusts.
export function normalizeCustomQuestions(value: unknown): CustomQuestion[] {
  if (!Array.isArray(value)) return []
  const out: CustomQuestion[] = []
  const used: Record<CustomQuestionSurface, number> = { signin: 0, success: 0 }
  const seenIds = new Set<string>()

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const q = raw as Record<string, unknown>
    if (typeof q.id !== 'string' || !q.id.trim()) continue
    if (typeof q.prompt !== 'string') continue

    const id = q.id.trim()
    if (seenIds.has(id)) continue

    const prompt = q.prompt.trim().slice(0, MAX_PROMPT_LENGTH)
    if (!prompt) continue

    const surface: CustomQuestionSurface = q.surface === 'signin' ? 'signin' : 'success'
    if (used[surface] >= SURFACE_LIMITS[surface]) continue

    const type: CustomQuestionType = q.type === 'choice' ? 'choice' : 'text'

    // A choice question with no usable options would render as an unanswerable
    // dead end, so it's dropped entirely rather than shown empty.
    let options: string[] = []
    if (type === 'choice') {
      const rawOptions = Array.isArray(q.options) ? q.options : []
      for (const opt of rawOptions) {
        if (typeof opt !== 'string') continue
        const clean = opt.trim().slice(0, MAX_OPTION_LENGTH)
        if (!clean || options.includes(clean)) continue
        options.push(clean)
        if (options.length >= MAX_CHOICE_OPTIONS) break
      }
      if (options.length === 0) continue
    }

    seenIds.add(id)
    used[surface]++
    out.push({ id, prompt, type, options, surface })
  }
  return out
}

export function questionsForSurface(
  questions: CustomQuestion[],
  surface: CustomQuestionSurface
): CustomQuestion[] {
  return questions.filter(q => q.surface === surface)
}

// Turn a raw {questionId: answer} payload from the browser into snapshotted
// answer rows. Never trusts the client: only ids that match a real question are
// kept, and a choice answer must be one of that question's own options (so the
// visitor can't post arbitrary text into a multiple-choice field). Blank
// answers are dropped — every custom question is optional.
export function buildCustomAnswers(
  questions: CustomQuestion[],
  raw: unknown
): CustomAnswer[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const payload = raw as Record<string, unknown>
  const out: CustomAnswer[] = []

  for (const q of questions) {
    const value = payload[q.id]
    if (typeof value !== 'string') continue
    const answer = value.trim().slice(0, MAX_ANSWER_LENGTH)
    if (!answer) continue
    if (q.type === 'choice' && !q.options.includes(answer)) continue
    out.push({ id: q.id, prompt: q.prompt, answer })
  }
  return out
}

// Coerce a stored visitors.custom_answers value back into a clean list for
// display (dashboard, CSV, CRM email). Tolerant of anything malformed.
export function normalizeCustomAnswers(value: unknown): CustomAnswer[] {
  if (!Array.isArray(value)) return []
  const out: CustomAnswer[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const a = raw as Record<string, unknown>
    if (typeof a.id !== 'string' || typeof a.prompt !== 'string' || typeof a.answer !== 'string') continue
    if (!a.prompt.trim() || !a.answer.trim()) continue
    out.push({ id: a.id, prompt: a.prompt, answer: a.answer })
  }
  return out
}

// The sign-in answer is written at registration; the success-screen answers
// arrive later on the same visitor via /api/feedback. Merging (rather than
// overwriting) keeps both, and a re-answered question replaces its own earlier
// value instead of appearing twice.
export function mergeCustomAnswers(existing: unknown, incoming: CustomAnswer[]): CustomAnswer[] {
  const base = normalizeCustomAnswers(existing)
  const replaced = new Set(incoming.map(a => a.id))
  return [...base.filter(a => !replaced.has(a.id)), ...incoming]
}
