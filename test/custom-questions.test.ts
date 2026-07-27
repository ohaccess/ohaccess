import { describe, it, expect } from 'vitest'
import {
  normalizeCustomQuestions,
  questionsForSurface,
  buildCustomAnswers,
  normalizeCustomAnswers,
  mergeCustomAnswers,
  MAX_CHOICE_OPTIONS,
  MAX_PROMPT_LENGTH,
  MAX_ANSWER_LENGTH,
  type CustomQuestion,
} from '@/lib/custom-questions'

const textQ: CustomQuestion = {
  id: 'q1', prompt: 'Are you pre-approved?', type: 'text', options: [], surface: 'signin',
}
const choiceQ: CustomQuestion = {
  id: 'q2', prompt: 'How did you hear about us?', type: 'choice',
  options: ['Sign', 'Zillow', 'Friend'], surface: 'success',
}

describe('normalizeCustomQuestions', () => {
  it('returns [] for anything that is not an array', () => {
    expect(normalizeCustomQuestions(null)).toEqual([])
    expect(normalizeCustomQuestions(undefined)).toEqual([])
    expect(normalizeCustomQuestions('nope')).toEqual([])
    expect(normalizeCustomQuestions({ id: 'q1' })).toEqual([])
  })

  it('keeps a well-formed text question and trims the prompt', () => {
    expect(normalizeCustomQuestions([
      { id: 'q1', prompt: '  Budget?  ', type: 'text', surface: 'signin' },
    ])).toEqual([{ id: 'q1', prompt: 'Budget?', type: 'text', options: [], surface: 'signin' }])
  })

  it('drops rows with no id or a blank prompt', () => {
    expect(normalizeCustomQuestions([
      { prompt: 'No id', type: 'text', surface: 'signin' },
      { id: 'q1', prompt: '   ', type: 'text', surface: 'signin' },
      { id: '  ', prompt: 'Blank id', type: 'text', surface: 'signin' },
    ])).toEqual([])
  })

  it('allows only ONE sign-in question — the entry gate stays short', () => {
    const got = normalizeCustomQuestions([
      { id: 'a', prompt: 'First', type: 'text', surface: 'signin' },
      { id: 'b', prompt: 'Second', type: 'text', surface: 'signin' },
      { id: 'c', prompt: 'Third', type: 'text', surface: 'signin' },
    ])
    expect(got).toHaveLength(1)
    expect(got[0].prompt).toBe('First')
  })

  it('allows TWO success-screen questions', () => {
    const got = normalizeCustomQuestions([
      { id: 'a', prompt: 'One', type: 'text', surface: 'success' },
      { id: 'b', prompt: 'Two', type: 'text', surface: 'success' },
      { id: 'c', prompt: 'Three', type: 'text', surface: 'success' },
    ])
    expect(got.map(q => q.prompt)).toEqual(['One', 'Two'])
  })

  it('counts the two surfaces independently', () => {
    const got = normalizeCustomQuestions([
      { id: 'a', prompt: 'Sign-in', type: 'text', surface: 'signin' },
      { id: 'b', prompt: 'Success 1', type: 'text', surface: 'success' },
      { id: 'c', prompt: 'Success 2', type: 'text', surface: 'success' },
    ])
    expect(got).toHaveLength(3)
  })

  it('defaults an unknown surface to success (never silently onto the gate)', () => {
    const [q] = normalizeCustomQuestions([
      { id: 'a', prompt: 'Where?', type: 'text', surface: 'nonsense' },
    ])
    expect(q.surface).toBe('success')
  })

  it('defaults an unknown type to text', () => {
    const [q] = normalizeCustomQuestions([
      { id: 'a', prompt: 'Where?', type: 'rating', surface: 'success' },
    ])
    expect(q.type).toBe('text')
  })

  it('caps choice options at MAX_CHOICE_OPTIONS and dedupes them', () => {
    const [q] = normalizeCustomQuestions([{
      id: 'a', prompt: 'Pick', type: 'choice', surface: 'success',
      options: ['A', 'B', 'A', 'C', 'D', 'E', 'F'],
    }])
    expect(q.options).toEqual(['A', 'B', 'C', 'D'])
    expect(q.options).toHaveLength(MAX_CHOICE_OPTIONS)
  })

  it('drops a choice question with no usable options — it would be a dead end', () => {
    expect(normalizeCustomQuestions([
      { id: 'a', prompt: 'Pick', type: 'choice', surface: 'success', options: [] },
      { id: 'b', prompt: 'Pick', type: 'choice', surface: 'success', options: ['  ', 42] },
      { id: 'c', prompt: 'Pick', type: 'choice', surface: 'success' },
    ])).toEqual([])
  })

  it('caps an over-long prompt', () => {
    const [q] = normalizeCustomQuestions([
      { id: 'a', prompt: 'x'.repeat(500), type: 'text', surface: 'success' },
    ])
    expect(q.prompt).toHaveLength(MAX_PROMPT_LENGTH)
  })

  it('drops duplicate ids so answers can never be ambiguous', () => {
    const got = normalizeCustomQuestions([
      { id: 'dupe', prompt: 'First', type: 'text', surface: 'success' },
      { id: 'dupe', prompt: 'Second', type: 'text', surface: 'success' },
    ])
    expect(got).toHaveLength(1)
    expect(got[0].prompt).toBe('First')
  })

  it('survives junk entries without throwing', () => {
    expect(normalizeCustomQuestions([null, 7, 'str', [], { id: 5, prompt: 9 }])).toEqual([])
  })
})

describe('questionsForSurface', () => {
  it('splits by surface', () => {
    const qs = [textQ, choiceQ]
    expect(questionsForSurface(qs, 'signin')).toEqual([textQ])
    expect(questionsForSurface(qs, 'success')).toEqual([choiceQ])
  })
})

describe('buildCustomAnswers', () => {
  it('snapshots the prompt alongside the answer', () => {
    expect(buildCustomAnswers([textQ], { q1: 'Yes, with Chase' })).toEqual([
      { id: 'q1', prompt: 'Are you pre-approved?', answer: 'Yes, with Chase' },
    ])
  })

  it('ignores ids that do not match a real question', () => {
    expect(buildCustomAnswers([textQ], { nope: 'injected' })).toEqual([])
  })

  it('drops blank and whitespace-only answers — every question is optional', () => {
    expect(buildCustomAnswers([textQ], { q1: '   ' })).toEqual([])
    expect(buildCustomAnswers([textQ], {})).toEqual([])
  })

  it('accepts a choice answer that matches one of its own options', () => {
    expect(buildCustomAnswers([choiceQ], { q2: 'Zillow' })).toEqual([
      { id: 'q2', prompt: 'How did you hear about us?', answer: 'Zillow' },
    ])
  })

  it('rejects a choice answer that is not one of the options', () => {
    expect(buildCustomAnswers([choiceQ], { q2: '<script>alert(1)</script>' })).toEqual([])
    expect(buildCustomAnswers([choiceQ], { q2: 'Something else entirely' })).toEqual([])
  })

  it('caps an over-long text answer', () => {
    const [a] = buildCustomAnswers([textQ], { q1: 'x'.repeat(5000) })
    expect(a.answer).toHaveLength(MAX_ANSWER_LENGTH)
  })

  it('ignores non-string values and non-object payloads', () => {
    expect(buildCustomAnswers([textQ], { q1: 42 })).toEqual([])
    expect(buildCustomAnswers([textQ], null)).toEqual([])
    expect(buildCustomAnswers([textQ], ['q1'])).toEqual([])
  })
})

describe('normalizeCustomAnswers', () => {
  it('keeps well-formed rows and drops malformed ones', () => {
    expect(normalizeCustomAnswers([
      { id: 'a', prompt: 'Q', answer: 'A' },
      { id: 'b', prompt: '', answer: 'A' },
      { id: 'c', prompt: 'Q', answer: '  ' },
      null,
      { id: 1, prompt: 2, answer: 3 },
    ])).toEqual([{ id: 'a', prompt: 'Q', answer: 'A' }])
  })

  it('returns [] for a never-set column', () => {
    expect(normalizeCustomAnswers(null)).toEqual([])
  })
})

describe('mergeCustomAnswers', () => {
  const signin = [{ id: 'q1', prompt: 'Pre-approved?', answer: 'Yes' }]

  it('appends the success-screen answers to the sign-in answer', () => {
    const got = mergeCustomAnswers(signin, [{ id: 'q2', prompt: 'Heard via?', answer: 'Sign' }])
    expect(got).toEqual([
      { id: 'q1', prompt: 'Pre-approved?', answer: 'Yes' },
      { id: 'q2', prompt: 'Heard via?', answer: 'Sign' },
    ])
  })

  it('replaces an earlier answer to the same question rather than duplicating it', () => {
    const got = mergeCustomAnswers(signin, [{ id: 'q1', prompt: 'Pre-approved?', answer: 'No' }])
    expect(got).toEqual([{ id: 'q1', prompt: 'Pre-approved?', answer: 'No' }])
  })

  it('works when the visitor had no prior answers', () => {
    expect(mergeCustomAnswers(null, signin)).toEqual(signin)
  })

  it('keeps prior answers when nothing new arrives', () => {
    expect(mergeCustomAnswers(signin, [])).toEqual(signin)
  })
})

// The whole reason the prompt is stored per-answer: an agent editing or
// deleting a question in Settings must never rewrite what a past visitor was
// actually asked.
describe('answer snapshots survive later question edits', () => {
  it('keeps the original prompt after the agent rewrites the question', () => {
    const answered = buildCustomAnswers([textQ], { q1: 'Yes' })
    const edited = normalizeCustomQuestions([
      { id: 'q1', prompt: "What's your budget?", type: 'text', surface: 'signin' },
    ])
    expect(edited[0].prompt).toBe("What's your budget?")
    expect(answered[0].prompt).toBe('Are you pre-approved?')
  })

  it('keeps the answer readable after the agent deletes the question entirely', () => {
    const answered = buildCustomAnswers([textQ], { q1: 'Yes' })
    expect(normalizeCustomQuestions([])).toEqual([])
    expect(normalizeCustomAnswers(answered)).toEqual([
      { id: 'q1', prompt: 'Are you pre-approved?', answer: 'Yes' },
    ])
  })
})
