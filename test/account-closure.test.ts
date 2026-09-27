import { describe, it, expect } from 'vitest'
import { decideAccountClosure, buildAccountClosureEmail } from '../lib/account-closure'

const NOW = Date.parse('2026-09-26T12:00:00Z')
const FUTURE = '2027-03-01T12:00:00.000Z'
const PAST = '2026-01-01T00:00:00.000Z'

describe('decideAccountClosure', () => {
  it('free trial: deleted now', () => {
    expect(decideAccountClosure({ tier: 'free' }, NOW)).toEqual({ mode: 'now' })
    expect(decideAccountClosure(null, NOW)).toEqual({ mode: 'now' })
  })

  it('monthly Pro inside the period: scheduled at period end and stops renewal', () => {
    expect(decideAccountClosure({ tier: 'pro', billing_interval: 'month', stripe_subscription_id: 'sub_1', current_period_end: FUTURE }, NOW))
      .toEqual({ mode: 'scheduled', at: FUTURE, cancelStripe: true })
  })

  it('2-year prepaid inside the period: scheduled, and a pending cancel is not re-sent to Stripe', () => {
    expect(decideAccountClosure({ tier: 'pro', billing_interval: 'two_year_prepay', stripe_subscription_id: 'sub_2', current_period_end: FUTURE, subscription_canceled_at: FUTURE }, NOW))
      .toEqual({ mode: 'scheduled', at: FUTURE, cancelStripe: false })
  })

  it('legacy one-time 2-year prepay (no Stripe subscription) inside the window: scheduled, nothing to cancel', () => {
    expect(decideAccountClosure({ tier: 'pro', billing_interval: 'two_year_prepay', stripe_subscription_id: null, current_period_end: FUTURE }, NOW))
      .toEqual({ mode: 'scheduled', at: FUTURE, cancelStripe: false })
  })

  it('lapsed prepay: deleted now', () => {
    expect(decideAccountClosure({ tier: 'pro', billing_interval: 'two_year_prepay', stripe_subscription_id: null, current_period_end: PAST }, NOW))
      .toEqual({ mode: 'now' })
  })

  it('admin comp inside the window: scheduled at its end date', () => {
    expect(decideAccountClosure({ tier: 'pro', billing_interval: 'comped', stripe_subscription_id: null, current_period_end: FUTURE }, NOW))
      .toEqual({ mode: 'scheduled', at: FUTURE, cancelStripe: false })
  })

  it('team member covered by the team lead: deleted now (nothing of their own to run out)', () => {
    expect(decideAccountClosure({ tier: 'team', stripe_subscription_id: null, current_period_end: null }, NOW)).toEqual({ mode: 'now' })
    expect(decideAccountClosure({ tier: 'team', billing_interval: 'month', stripe_subscription_id: null, current_period_end: FUTURE }, NOW)).toEqual({ mode: 'now' })
  })

  it('team lead who owns the team subscription: scheduled', () => {
    expect(decideAccountClosure({ tier: 'team', billing_interval: 'month', stripe_subscription_id: 'sub_team', current_period_end: FUTURE }, NOW))
      .toEqual({ mode: 'scheduled', at: FUTURE, cancelStripe: true })
  })

  it('paid tier with no period end recorded: deleted now rather than scheduled for never', () => {
    expect(decideAccountClosure({ tier: 'pro', stripe_subscription_id: 'sub_x', current_period_end: null }, NOW)).toEqual({ mode: 'now' })
  })
})

describe('buildAccountClosureEmail', () => {
  it('immediate closure', () => {
    const { subject, html } = buildAccountClosureEmail({ firstName: 'Dana', decision: { mode: 'now' }, appUrl: 'https://www.ohaccess.com' })
    expect(subject).toBe('Your ohACCESS account has been closed')
    expect(html).toContain('Hi Dana,')
    expect(html).toContain('login no longer works')
    expect(html).toContain('up to 3 years')
    expect(html).toContain('https://www.ohaccess.com/privacy')
    expect(html).not.toContain('Keep my account')
  })

  it('scheduled closure names the date and the way back', () => {
    const { subject, html } = buildAccountClosureEmail({ firstName: '', decision: { mode: 'scheduled', at: FUTURE, cancelStripe: true }, appUrl: 'https://www.ohaccess.com' })
    expect(subject).toBe('Your ohACCESS account will close on March 1, 2027')
    expect(html).toContain('Hi there,')
    expect(html).toContain('<strong>March 1, 2027</strong>')
    expect(html).toContain('will not be charged again')
    expect(html).toContain('Keep my account')
    expect(html).toContain('https://www.ohaccess.com/dashboard')
  })
})
