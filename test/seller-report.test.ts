import { describe, it, expect } from 'vitest'
import { buildSellerReportStats } from '@/lib/seller-report'

const v = (timeline: string | null) => ({ purchasing_timeline: timeline })

describe('buildSellerReportStats', () => {
  it('groups timelines soonest-first and drops empty buckets', () => {
    const stats = buildSellerReportStats(
      [v('12+ Months'), v('0–3 Months'), v('0–3 Months'), v('6–12 Months')],
      0
    )
    expect(stats.total).toBe(4)
    expect(stats.groups).toEqual([
      { label: '0–3 Months', count: 2 },
      { label: '6–12 Months', count: 1 },
      { label: '12+ Months', count: 1 },
    ])
  })

  it('collects unrecognized and missing timelines under Other', () => {
    const stats = buildSellerReportStats([v('0–3 Months'), v(null), v('Just browsing')], 0)
    expect(stats.groups).toEqual([
      { label: '0–3 Months', count: 1 },
      { label: 'Other', count: 2 },
    ])
  })

  it('counts the two soonest buckets as buying within 6 months', () => {
    const stats = buildSellerReportStats(
      [v('0–3 Months'), v('3–6 Months'), v('6–12 Months'), v(null)],
      0
    )
    expect(stats.soonCount).toBe(2)
  })

  it('shows the scan funnel only when the scan log covers the event', () => {
    // Scan log predates the open house: fewer scans than registrations.
    expect(buildSellerReportStats([v(null), v(null), v(null)], 1).funnel).toBeNull()
    // No scans recorded at all.
    expect(buildSellerReportStats([v(null)], 0).funnel).toBeNull()
    // Healthy funnel: at least as many scans as registrations.
    expect(buildSellerReportStats([v(null), v(null)], 5).funnel).toEqual({
      scans: 5,
      registered: 2,
    })
  })

  it('handles an empty visitor list', () => {
    const stats = buildSellerReportStats([], 0)
    expect(stats.total).toBe(0)
    expect(stats.groups).toEqual([])
    expect(stats.soonCount).toBe(0)
    expect(stats.funnel).toBeNull()
    expect(stats.feedback).toBeNull()
  })

  it('returns null feedback when nobody answered', () => {
    expect(buildSellerReportStats([v('0–3 Months'), v(null)], 0).feedback).toBeNull()
  })

  it('aggregates feedback: mean rating (one decimal) and price sentiment counts', () => {
    const fb = (timeline: string | null, rating: number | null, price: string | null) => ({
      purchasing_timeline: timeline,
      feedback_rating: rating,
      feedback_price: price,
    })
    const stats = buildSellerReportStats(
      [
        fb('0–3 Months', 8, 'Too High'),
        fb('3–6 Months', 7, 'Reasonable'),
        fb('6–12 Months', 6, 'Too High'),
        fb('12+ Months', null, null), // registered but left no feedback
      ],
      0
    )
    expect(stats.feedback).toEqual({
      responses: 3,
      avgRating: 7, // (8+7+6)/3
      price: { high: 2, reasonable: 1, low: 0 },
    })
  })

  it('rounds the average rating to one decimal', () => {
    const fb = (rating: number) => ({ purchasing_timeline: null, feedback_rating: rating, feedback_price: 'Reasonable' })
    const stats = buildSellerReportStats([fb(8), fb(9), fb(9)], 0) // 26/3 = 8.666…
    expect(stats.feedback?.avgRating).toBe(8.7)
  })

  describe('custom questions', () => {
    const withAnswers = (answers: { id: string; prompt: string; answer: string }[]) => ({
      purchasing_timeline: null,
      custom_answers: answers,
    })

    it('returns no custom questions when nobody answered any', () => {
      expect(buildSellerReportStats([v(null)], 0).customQuestions).toEqual([])
      expect(buildSellerReportStats([v(null)], 0, [{ id: 'q1', prompt: 'Pre-approved?', type: 'choice', options: ['Yes', 'No'], surface: 'signin' }]).customQuestions).toEqual([])
    })

    it('counts choice answers per option, keeping zero-count options', () => {
      const questions = [{ id: 'q1', prompt: 'Are you pre-approved?', type: 'choice', options: ['Yes', 'No', 'Not sure'], surface: 'signin' }]
      const stats = buildSellerReportStats(
        [
          withAnswers([{ id: 'q1', prompt: 'Are you pre-approved?', answer: 'Yes' }]),
          withAnswers([{ id: 'q1', prompt: 'Are you pre-approved?', answer: 'Yes' }]),
          withAnswers([{ id: 'q1', prompt: 'Are you pre-approved?', answer: 'No' }]),
          withAnswers([]), // signed in but skipped the question
        ],
        0,
        questions
      )
      expect(stats.customQuestions).toEqual([
        {
          id: 'q1',
          prompt: 'Are you pre-approved?',
          responses: 3,
          choices: [
            { label: 'Yes', count: 2 },
            { label: 'No', count: 1 },
            { label: 'Not sure', count: 0 },
          ],
          answers: [],
        },
      ])
    })

    it('appends answers recorded under options that were later removed', () => {
      const questions = [{ id: 'q1', prompt: 'Financing?', type: 'choice', options: ['Cash', 'Mortgage'], surface: 'signin' }]
      const stats = buildSellerReportStats(
        [withAnswers([{ id: 'q1', prompt: 'Financing?', answer: 'VA loan' }])],
        0,
        questions
      )
      expect(stats.customQuestions[0].choices).toEqual([
        { label: 'Cash', count: 0 },
        { label: 'Mortgage', count: 0 },
        { label: 'VA loan', count: 1 },
      ])
    })

    it('lists free-text answers in sign-in order', () => {
      const questions = [{ id: 'q2', prompt: 'What did you think of the kitchen?', type: 'text', options: [], surface: 'success' }]
      const stats = buildSellerReportStats(
        [
          withAnswers([{ id: 'q2', prompt: 'What did you think of the kitchen?', answer: 'Loved it' }]),
          withAnswers([{ id: 'q2', prompt: 'What did you think of the kitchen?', answer: 'A bit dated' }]),
        ],
        0,
        questions
      )
      expect(stats.customQuestions).toEqual([
        {
          id: 'q2',
          prompt: 'What did you think of the kitchen?',
          responses: 2,
          choices: null,
          answers: ['Loved it', 'A bit dated'],
        },
      ])
    })

    it('groups by question id, using the live prompt after a reword', () => {
      const questions = [{ id: 'q1', prompt: 'Pre-approved for a mortgage?', type: 'choice', options: ['Yes', 'No'], surface: 'signin' }]
      const stats = buildSellerReportStats(
        [
          withAnswers([{ id: 'q1', prompt: 'Pre-approved?', answer: 'Yes' }]), // answered before the reword
          withAnswers([{ id: 'q1', prompt: 'Pre-approved for a mortgage?', answer: 'No' }]),
        ],
        0,
        questions
      )
      expect(stats.customQuestions).toHaveLength(1)
      expect(stats.customQuestions[0].prompt).toBe('Pre-approved for a mortgage?')
      expect(stats.customQuestions[0].responses).toBe(2)
    })

    it('keeps answers to a question deleted from Settings, as free text under its snapshotted prompt', () => {
      const stats = buildSellerReportStats(
        [withAnswers([{ id: 'gone', prompt: 'Working with an agent?', answer: 'Yes' }])],
        0,
        [] // question no longer in the profile
      )
      expect(stats.customQuestions).toEqual([
        { id: 'gone', prompt: 'Working with an agent?', responses: 1, choices: null, answers: ['Yes'] },
      ])
    })

    it('charts a deleted choice question from its repeating answers, most-picked first', () => {
      const a = (answer: string) =>
        withAnswers([{ id: 'gone', prompt: 'Do you currently have a property to sell?', answer }])
      const stats = buildSellerReportStats(
        [a('Yes'), a('No'), a('No'), a('No'), a('Yes')],
        0,
        [] // question deleted from Settings — no option list left
      )
      expect(stats.customQuestions).toEqual([
        {
          id: 'gone',
          prompt: 'Do you currently have a property to sell?',
          responses: 5,
          choices: [
            { label: 'No', count: 3 },
            { label: 'Yes', count: 2 },
          ],
          answers: [],
        },
      ])
    })

    it('keeps a deleted free-text question as a list — its answers are all distinct', () => {
      const a = (answer: string) => withAnswers([{ id: 'gone', prompt: 'Any feedback?', answer }])
      const stats = buildSellerReportStats(
        [a('Loved the garden'), a('Kitchen felt dated'), a('Great street')],
        0,
        []
      )
      expect(stats.customQuestions[0].choices).toBeNull()
      expect(stats.customQuestions[0].answers).toEqual([
        'Loved the garden',
        'Kitchen felt dated',
        'Great street',
      ])
    })

    it('orders live questions by the agent’s configured order, then deleted ones', () => {
      const questions = [
        { id: 'a', prompt: 'First?', type: 'text', options: [], surface: 'signin' },
        { id: 'b', prompt: 'Second?', type: 'text', options: [], surface: 'success' },
      ]
      const stats = buildSellerReportStats(
        [
          withAnswers([
            { id: 'gone', prompt: 'Old question?', answer: 'x' },
            { id: 'b', prompt: 'Second?', answer: 'y' },
            { id: 'a', prompt: 'First?', answer: 'z' },
          ]),
        ],
        0,
        questions
      )
      expect(stats.customQuestions.map(q => q.id)).toEqual(['a', 'b', 'gone'])
    })
  })
})
