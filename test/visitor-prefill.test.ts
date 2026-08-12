import { describe, it, expect } from 'vitest'
import { serializeVisitorPrefill, parseVisitorPrefill } from '@/lib/visitor-prefill'

const sample = {
  firstName: 'Sarah',
  lastName: "O'Brien",
  email: 'sarah@example.com',
  phone: '(415) 867-5309',
}

describe('visitor prefill cookie', () => {
  it('round-trips a normal visitor', () => {
    const raw = serializeVisitorPrefill(sample)
    expect(raw).toBeTruthy()
    expect(parseVisitorPrefill(raw)).toEqual(sample)
  })

  it('survives unicode names', () => {
    const v = { ...sample, firstName: 'José', lastName: '张伟' }
    expect(parseVisitorPrefill(serializeVisitorPrefill(v))).toEqual(v)
  })

  it('trims whitespace on the way in', () => {
    const raw = serializeVisitorPrefill({ ...sample, firstName: '  Sarah  ' })
    expect(parseVisitorPrefill(raw)?.firstName).toBe('Sarah')
  })

  it('round-trips the sign-in language', () => {
    const v = { ...sample, lang: 'vi' as const }
    expect(parseVisitorPrefill(serializeVisitorPrefill(v))).toEqual(v)
  })

  it('omits an unknown language instead of failing the whole cookie', () => {
    const raw = serializeVisitorPrefill({ ...sample, lang: 'xx' as never })
    expect(parseVisitorPrefill(raw)).toEqual(sample)
  })

  it('still parses cookies set before the lang field existed', () => {
    const raw = encodeURIComponent(JSON.stringify(sample))
    expect(parseVisitorPrefill(raw)).toEqual(sample)
  })

  it('drops a tampered lang value on parse, keeping the rest', () => {
    const raw = encodeURIComponent(JSON.stringify({ ...sample, lang: 'toString' }))
    expect(parseVisitorPrefill(raw)).toEqual(sample)
  })

  it('refuses to serialize incomplete or oversized data', () => {
    expect(serializeVisitorPrefill({ ...sample, email: '' })).toBeNull()
    expect(serializeVisitorPrefill({ ...sample, phone: '   ' })).toBeNull()
    expect(serializeVisitorPrefill({ ...sample, firstName: 'x'.repeat(81) })).toBeNull()
  })

  it('returns null for garbage cookies instead of throwing', () => {
    expect(parseVisitorPrefill(undefined)).toBeNull()
    expect(parseVisitorPrefill(null)).toBeNull()
    expect(parseVisitorPrefill('')).toBeNull()
    expect(parseVisitorPrefill('not json')).toBeNull()
    expect(parseVisitorPrefill('%')).toBeNull() // malformed URI encoding
    expect(parseVisitorPrefill(encodeURIComponent('"just a string"'))).toBeNull()
    expect(parseVisitorPrefill(encodeURIComponent('{"firstName":"A"}'))).toBeNull()
    expect(parseVisitorPrefill(encodeURIComponent(JSON.stringify({ ...sample, phone: 42 })))).toBeNull()
    expect(parseVisitorPrefill('x'.repeat(3000))).toBeNull()
  })
})
