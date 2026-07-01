import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isAdmin } from '@/lib/auth'

const ORIGINAL = process.env.ADMIN_EMAILS

describe('isAdmin', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'boss@ohaccess.com, Dave@Reflectre.com'
  })
  afterEach(() => {
    process.env.ADMIN_EMAILS = ORIGINAL
  })

  it('matches an allowlisted email case-insensitively', () => {
    expect(isAdmin('boss@ohaccess.com')).toBe(true)
    expect(isAdmin('BOSS@OHACCESS.COM')).toBe(true)
    expect(isAdmin('dave@reflectre.com')).toBe(true)
  })
  it('rejects a non-listed email', () => {
    expect(isAdmin('stranger@example.com')).toBe(false)
  })
  it('rejects empty / undefined input', () => {
    expect(isAdmin(undefined)).toBe(false)
    expect(isAdmin('')).toBe(false)
  })
  it('returns false when the allowlist is empty', () => {
    process.env.ADMIN_EMAILS = ''
    expect(isAdmin('boss@ohaccess.com')).toBe(false)
  })
  it('ignores blank entries and surrounding whitespace in the list', () => {
    process.env.ADMIN_EMAILS = ' , boss@ohaccess.com , '
    expect(isAdmin('boss@ohaccess.com')).toBe(true)
    expect(isAdmin('')).toBe(false)
  })
})
