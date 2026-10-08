import { describe, it, expect, vi } from 'vitest'

// The module imports the service-role client at load; stub it so the pure
// helpers can be tested without env vars.
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: {} }))

const { normalizeEmail, recipientsFromResendEvent, suppressionReasonForEvent } = await import('../lib/email-suppressions')

describe('recipientsFromResendEvent', () => {
  it('accepts the array and string forms Resend uses', () => {
    expect(recipientsFromResendEvent({ to: ['a@x.com', 'b@x.com'] })).toEqual(['a@x.com', 'b@x.com'])
    expect(recipientsFromResendEvent({ to: 'a@x.com' })).toEqual(['a@x.com'])
    expect(recipientsFromResendEvent({})).toEqual([])
    expect(recipientsFromResendEvent(undefined)).toEqual([])
  })
})

describe('suppressionReasonForEvent', () => {
  it('always suppresses on a spam complaint', () => {
    expect(suppressionReasonForEvent('email.complained', {})).toBe('complained')
  })
  it('suppresses hard bounces but not transient ones', () => {
    expect(suppressionReasonForEvent('email.bounced', { bounce: { type: 'Permanent' } })).toBe('bounced')
    expect(suppressionReasonForEvent('email.bounced', {})).toBe('bounced')
    expect(suppressionReasonForEvent('email.bounced', { bounce: { type: 'Transient' } })).toBeNull()
  })
  it('ignores every other event', () => {
    expect(suppressionReasonForEvent('email.delivered', {})).toBeNull()
    expect(suppressionReasonForEvent(undefined, {})).toBeNull()
  })
})

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Dave@Example.COM ')).toBe('dave@example.com')
    expect(normalizeEmail(null)).toBe('')
  })
})
