import { describe, it, expect } from 'vitest'
import {
  offerPhase,
  normalizeStateCode,
  isHardwareChoice,
  STATE_LIMIT,
  SCARCITY_THRESHOLD,
  SOCIAL_PROOF_THRESHOLD,
} from '@/lib/hardware-offer'

describe('offerPhase', () => {
  it('starts generic with no claims', () => {
    expect(offerPhase(0)).toBe('generic')
  })

  it('stays generic below the social-proof threshold', () => {
    expect(offerPhase(SOCIAL_PROOF_THRESHOLD - 1)).toBe('generic')
  })

  it('switches to social proof at the claimed threshold', () => {
    expect(offerPhase(SOCIAL_PROOF_THRESHOLD)).toBe('claimed')
  })

  it('switches to scarcity when remaining hits the threshold', () => {
    expect(offerPhase(STATE_LIMIT - SCARCITY_THRESHOLD)).toBe('remaining')
    expect(offerPhase(STATE_LIMIT - SCARCITY_THRESHOLD - 1)).toBe('claimed')
  })

  it('is exhausted at and beyond the limit', () => {
    expect(offerPhase(STATE_LIMIT)).toBe('exhausted')
    expect(offerPhase(STATE_LIMIT + 5)).toBe('exhausted')
  })

  it('scarcity always wins over social proof (both facts true, scarcity shown)', () => {
    expect(offerPhase(99)).toBe('remaining')
  })
})

describe('normalizeStateCode', () => {
  it('accepts 2-letter codes in any case', () => {
    expect(normalizeStateCode('OH')).toBe('OH')
    expect(normalizeStateCode('oh')).toBe('OH')
    expect(normalizeStateCode(' tx ')).toBe('TX')
  })

  it('accepts full state names', () => {
    expect(normalizeStateCode('Ohio')).toBe('OH')
    expect(normalizeStateCode('new hampshire')).toBe('NH')
  })

  it('rejects non-states', () => {
    expect(normalizeStateCode('Ontario')).toBeNull()
    expect(normalizeStateCode('ZZ')).toBeNull()
    expect(normalizeStateCode('')).toBeNull()
    expect(normalizeStateCode(null)).toBeNull()
    expect(normalizeStateCode(undefined)).toBeNull()
  })
})

describe('isHardwareChoice', () => {
  it('accepts the two dropdown values and nothing else', () => {
    expect(isHardwareChoice('pedestal_pair')).toBe(true)
    expect(isHardwareChoice('a_frame')).toBe(true)
    expect(isHardwareChoice('both_please')).toBe(false)
    expect(isHardwareChoice(undefined)).toBe(false)
  })
})
