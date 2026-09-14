import { describe, it, expect } from 'vitest'
import { validateManualVisitor, isManualVisitor, MANUAL_NOTES_MAX } from '@/lib/manual-visitor'

const ok = (body: Record<string, unknown>, country = 'US') => {
  const r = validateManualVisitor(body, country)
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`)
  return r.fields
}
const err = (body: Record<string, unknown>, country = 'US') => {
  const r = validateManualVisitor(body, country)
  if (r.ok) throw new Error('expected an error')
  return r.error
}

describe('validateManualVisitor', () => {
  it('accepts a first name plus a mobile number', () => {
    const f = ok({ firstName: ' John ', phone: '5128675309' })
    expect(f.first_name).toBe('John')
    expect(f.last_name).toBeNull()
    expect(f.email).toBeNull()
    expect(f.phone).toBe('(512) 867-5309')
  })
  it('accepts a first name plus an email, lower-cased', () => {
    const f = ok({ firstName: 'John', lastName: 'Smith', email: 'John.Smith@Example.com' })
    expect(f.email).toBe('john.smith@example.com')
    expect(f.phone).toBeNull()
  })
  it('needs a first name', () => {
    expect(err({ lastName: 'Smith', email: 'a@b.com' })).toMatch(/first name/)
  })
  it('needs a mobile or an email', () => {
    expect(err({ firstName: 'John' })).toMatch(/mobile number or an email/)
  })
  it('rejects a bad email or phone', () => {
    expect(err({ firstName: 'John', email: 'not-an-email' })).toMatch(/email/)
    expect(err({ firstName: 'John', phone: '123' })).toBeTruthy()
  })
  it('reads a phone in the chosen country', () => {
    const f = ok({ firstName: 'Ann', phone: '0412 345 678', phoneCountry: 'AU' })
    expect(f.phone).toMatch(/^\+61/)
  })
  it('only takes timelines from the list, blank allowed', () => {
    expect(ok({ firstName: 'J', email: 'a@b.com', timeline: '0–3 Months' }).purchasing_timeline).toBe('0–3 Months')
    expect(ok({ firstName: 'J', email: 'a@b.com', timeline: '' }).purchasing_timeline).toBeNull()
    expect(err({ firstName: 'J', email: 'a@b.com', timeline: 'Tomorrow' })).toMatch(/timeline/)
  })
  it('caps notes', () => {
    expect(ok({ firstName: 'J', email: 'a@b.com', notes: '  met at door ' }).notes).toBe('met at door')
    expect(err({ firstName: 'J', email: 'a@b.com', notes: 'x'.repeat(MANUAL_NOTES_MAX + 1) })).toMatch(/Notes/)
  })
  it('handles a missing body', () => {
    expect(validateManualVisitor(null, 'US').ok).toBe(false)
  })
})

describe('isManualVisitor', () => {
  it('is true only for source manual', () => {
    expect(isManualVisitor({ source: 'manual' })).toBe(true)
    expect(isManualVisitor({ source: 'ohaccess' })).toBe(false)
    expect(isManualVisitor({ source: null })).toBe(false)
    expect(isManualVisitor(null)).toBe(false)
  })
})
