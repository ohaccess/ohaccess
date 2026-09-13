import { describe, it, expect } from 'vitest'
import {
  needsAgentVerification,
  licenceRequirement,
  licenceError,
  lineTypeProblem,
  verificationSmsBody,
  VERIFY_CODE_LENGTH,
} from '@/lib/agent-verification'
import { generateVerificationCode, hashVerificationCode, verificationCodeMatches } from '@/lib/agent-verification-codes'

describe('needsAgentVerification', () => {
  it('is false before migration 051 (column absent)', () => {
    expect(needsAgentVerification({ id: 'x', phone: null })).toBe(false)
    expect(needsAgentVerification(null)).toBe(false)
  })
  it('is true when the column is present but unset', () => {
    expect(needsAgentVerification({ agent_verified_at: null })).toBe(true)
  })
  it('is false once verified', () => {
    expect(needsAgentVerification({ agent_verified_at: '2026-09-13T12:00:00Z' })).toBe(false)
  })
})

describe('licenceRequirement', () => {
  it('requires a number and a state in the US', () => {
    const req = licenceRequirement('US')
    expect(req?.numberLabel).toBe('License Number')
    expect(req?.regions?.some(r => r.code === 'TX')).toBe(true)
  })
  it('is null where agents are not licensed (UK)', () => {
    expect(licenceRequirement('GB')).toBeNull()
  })
  it('is null where the number is optional (Germany, Mexico)', () => {
    expect(licenceRequirement('DE')).toBeNull()
    expect(licenceRequirement('MX')).toBeNull()
  })
  it('is null for countries without an explicit entry (optional default)', () => {
    expect(licenceRequirement('JP')).toBeNull()
  })
  it('requires a national number with no region in New Zealand', () => {
    const req = licenceRequirement('NZ')
    expect(req).not.toBeNull()
    expect(req?.regionLabel).toBeNull()
  })
})

describe('licenceError', () => {
  it('passes a US number with a real state', () => {
    expect(licenceError('US', '0612345', 'tx')).toBeNull()
  })
  it('rejects a missing number', () => {
    expect(licenceError('US', '  ', 'TX')).toMatch(/license number/)
  })
  it('rejects a missing or unknown state', () => {
    expect(licenceError('US', '0612345', '')).toMatch(/state/)
    expect(licenceError('US', '0612345', 'ZZ')).toMatch(/state/)
  })
  it('never blocks where no licence is required', () => {
    expect(licenceError('GB', '', '')).toBeNull()
  })
  it('does not ask for a region in a national scheme', () => {
    expect(licenceError('NZ', '10012345', '')).toBeNull()
  })
})

describe('lineTypeProblem', () => {
  it('refuses app/internet numbers', () => {
    expect(lineTypeProblem('nonFixedVoip')).toMatch(/Google Voice/)
  })
  it('refuses landlines', () => {
    expect(lineTypeProblem('landline')).toMatch(/mobile/)
  })
  it('allows mobiles, cable-home VoIP, and unknown lookups', () => {
    expect(lineTypeProblem('mobile')).toBeNull()
    expect(lineTypeProblem('fixedVoip')).toBeNull()
    expect(lineTypeProblem(null)).toBeNull()
  })
})

describe('verification codes', () => {
  it('generates zero-padded 6-digit codes', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateVerificationCode()).toMatch(new RegExp(`^\\d{${VERIFY_CODE_LENGTH}}$`))
    }
  })
  it('matches only the right code for the right user', () => {
    const hash = hashVerificationCode('042917', 'user-a')
    expect(verificationCodeMatches('042917', 'user-a', hash)).toBe(true)
    expect(verificationCodeMatches('042 917', 'user-a', hash)).toBe(true)
    expect(verificationCodeMatches('042918', 'user-a', hash)).toBe(false)
    expect(verificationCodeMatches('042917', 'user-b', hash)).toBe(false)
  })
  it('rejects malformed input without throwing', () => {
    expect(verificationCodeMatches('', 'user-a', 'nothex')).toBe(false)
    expect(verificationCodeMatches('12345', 'user-a', hashVerificationCode('12345', 'user-a'))).toBe(false)
  })
  it('keeps the text plain ASCII and one segment', () => {
    const body = verificationSmsBody('123456')
    expect(/^[\x20-\x7e]*$/.test(body)).toBe(true)
    expect(body.length).toBeLessThanOrEqual(160)
  })
})
