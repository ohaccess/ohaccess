import { describe, it, expect } from 'vitest'
import {
  GIFT_CODE_ALPHABET,
  GIFT_MONTHS,
  generateGiftCode,
  normalizeGiftCode,
  giftAccessEnd,
} from '@/lib/gift'

describe('gift codes', () => {
  it('generates canonical GIFT-XXXX-XXXX codes from the safe alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateGiftCode()
      expect(code).toMatch(/^GIFT-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
      for (const ch of code.replace(/^GIFT-/, '').replace('-', '')) {
        expect(GIFT_CODE_ALPHABET).toContain(ch)
      }
    }
  })

  it('excludes lookalike characters from the alphabet', () => {
    for (const ch of ['0', 'O', '1', 'I', 'L']) {
      expect(GIFT_CODE_ALPHABET).not.toContain(ch)
    }
  })

  it('normalizes human variations to the canonical form', () => {
    expect(normalizeGiftCode('GIFT-ABCD-EFGH')).toBe('GIFT-ABCD-EFGH')
    expect(normalizeGiftCode('gift-abcd-efgh')).toBe('GIFT-ABCD-EFGH')
    expect(normalizeGiftCode('ABCDEFGH')).toBe('GIFT-ABCD-EFGH')
    expect(normalizeGiftCode('abcd efgh')).toBe('GIFT-ABCD-EFGH')
    expect(normalizeGiftCode(' gift ABCD-EFGH ')).toBe('GIFT-ABCD-EFGH')
    expect(normalizeGiftCode('GIFTABCDEFGH')).toBe('GIFT-ABCD-EFGH')
  })

  it('rejects things that cannot be gift codes', () => {
    expect(normalizeGiftCode('')).toBeNull()
    expect(normalizeGiftCode('GIFT-ABC-DEFG')).toBeNull() // wrong length
    expect(normalizeGiftCode('GIFT-ABCD-EFG0')).toBeNull() // 0 not in alphabet
    expect(normalizeGiftCode('GIFT-ABCD-EFGI')).toBeNull() // I not in alphabet
    expect(normalizeGiftCode(42)).toBeNull()
    expect(normalizeGiftCode(null)).toBeNull()
    expect(normalizeGiftCode(undefined)).toBeNull()
  })

  it('a normalized code round-trips through normalize', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateGiftCode()
      expect(normalizeGiftCode(code)).toBe(code)
      expect(normalizeGiftCode(code.toLowerCase())).toBe(code)
    }
  })
})

describe('giftAccessEnd', () => {
  const now = new Date('2026-07-14T12:00:00Z')

  it('is 12 months', () => {
    expect(GIFT_MONTHS).toBe(12)
  })

  it('gives a full year from now when there is no existing access', () => {
    expect(giftAccessEnd(null, now).toISOString()).toBe('2027-07-14T12:00:00.000Z')
    expect(giftAccessEnd(undefined, now).toISOString()).toBe('2027-07-14T12:00:00.000Z')
  })

  it('stacks a full year on top of remaining paid time', () => {
    expect(giftAccessEnd('2026-10-01T00:00:00Z', now).toISOString()).toBe('2027-10-01T00:00:00.000Z')
  })

  it('ignores an already-expired access date', () => {
    expect(giftAccessEnd('2026-01-01T00:00:00Z', now).toISOString()).toBe('2027-07-14T12:00:00.000Z')
  })

  it('ignores garbage access dates', () => {
    expect(giftAccessEnd('not-a-date', now).toISOString()).toBe('2027-07-14T12:00:00.000Z')
  })

  it('handles leap-day starts', () => {
    const leap = new Date('2028-02-29T12:00:00Z')
    // Feb 29 + 1 year rolls to Mar 1 — a day gained, never lost.
    expect(giftAccessEnd(null, leap).toISOString()).toBe('2029-03-01T12:00:00.000Z')
  })
})
