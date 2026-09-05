import { describe, it, expect } from 'vitest'
import {
  decideDripEmail,
  DAY_MS,
  FINISH_SETUP_CEILING_MS,
  type DripAgentState,
} from '../lib/drip'

const NOW = new Date('2026-09-05T15:00:00Z')

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString()
}

// A logged-in, free-tier agent with no activity and nothing sent yet; tests
// override the fields they exercise.
function state(overrides: Partial<DripAgentState> = {}): DripAgentState {
  return {
    createdAt: daysAgo(3),
    lastSignInAt: daysAgo(3),
    optedOut: false,
    hasEmail: true,
    paidAccess: false,
    hardwareOfferActive: true,
    hasHardwareClaim: false,
    openHouseCount: 0,
    lastOpenHouseActivityAt: null,
    hasUpcomingOpenHouse: false,
    sent: {},
    ...overrides,
  }
}

describe('global guardrails', () => {
  it('sends nothing to opted-out agents or missing emails', () => {
    expect(decideDripEmail(state({ optedOut: true, createdAt: daysAgo(10) }), NOW)).toBeNull()
    expect(decideDripEmail(state({ hasEmail: false, createdAt: daysAgo(10) }), NOW)).toBeNull()
  })

  it('never sends within 7 days of the previous drip email', () => {
    const s = state({
      createdAt: daysAgo(20),
      openHouseCount: 1,
      lastOpenHouseActivityAt: daysAgo(2),
      sent: { first_open_house: daysAgo(3) },
    })
    expect(decideDripEmail(s, NOW)).toBeNull()
    // …but does once the window passes.
    s.sent.first_open_house = daysAgo(8)
    expect(decideDripEmail(s, NOW)).toBe('referral')
  })

  it('rejects an unparsable createdAt', () => {
    expect(decideDripEmail(state({ createdAt: 'not-a-date' }), NOW)).toBeNull()
  })
})

describe('finish_setup (day 2, never logged in)', () => {
  it('fires between day 2 and day 30, once', () => {
    expect(decideDripEmail(state({ lastSignInAt: null, createdAt: daysAgo(1) }), NOW)).toBeNull()
    expect(decideDripEmail(state({ lastSignInAt: null, createdAt: daysAgo(2) }), NOW)).toBe('finish_setup')
    expect(decideDripEmail(state({ lastSignInAt: null, createdAt: daysAgo(29) }), NOW)).toBe('finish_setup')
    expect(
      decideDripEmail(
        state({ lastSignInAt: null, createdAt: daysAgo(FINISH_SETUP_CEILING_MS / DAY_MS + 1) }),
        NOW
      )
    ).toBeNull()
    expect(
      decideDripEmail(
        state({ lastSignInAt: null, createdAt: daysAgo(10), sent: { finish_setup: daysAgo(8) } }),
        NOW
      )
    ).toBeNull()
  })

  it('is the ONLY email a never-logged-in account can get', () => {
    const s = state({
      lastSignInAt: null,
      createdAt: daysAgo(60),
      sent: { finish_setup: daysAgo(45) },
    })
    expect(decideDripEmail(s, NOW)).toBeNull()
  })
})

describe('first_open_house (day 5, logged in, no open house)', () => {
  it('fires at day 5 and skips agents who already created one', () => {
    expect(decideDripEmail(state({ createdAt: daysAgo(4) }), NOW)).toBeNull()
    expect(decideDripEmail(state({ createdAt: daysAgo(5) }), NOW)).toBe('first_open_house')
    expect(
      decideDripEmail(state({ createdAt: daysAgo(5), openHouseCount: 2, lastOpenHouseActivityAt: daysAgo(1) }), NOW)
    ).toBeNull()
  })
})

describe('referral (day 12, has used the product)', () => {
  it('requires at least one open house', () => {
    const active = state({
      createdAt: daysAgo(12),
      openHouseCount: 1,
      lastOpenHouseActivityAt: daysAgo(2),
    })
    expect(decideDripEmail(active, NOW)).toBe('referral')
    // No open house → the first_open_house nudge outranks it instead.
    expect(decideDripEmail(state({ createdAt: daysAgo(12) }), NOW)).toBe('first_open_house')
  })

  it('goes to paid agents too', () => {
    const s = state({
      createdAt: daysAgo(12),
      paidAccess: true,
      openHouseCount: 3,
      lastOpenHouseActivityAt: daysAgo(2),
    })
    expect(decideDripEmail(s, NOW)).toBe('referral')
  })
})

describe('hardware_offer (day 21, free tier)', () => {
  const base = () =>
    state({
      createdAt: daysAgo(21),
      openHouseCount: 1,
      lastOpenHouseActivityAt: daysAgo(2),
      sent: { referral: daysAgo(9) },
    })

  it('fires for free agents at day 21', () => {
    expect(decideDripEmail(base(), NOW)).toBe('hardware_offer')
  })

  it('skips paid, sponsored, already-claimed, and offer-off', () => {
    expect(decideDripEmail({ ...base(), paidAccess: true }, NOW)).toBeNull()
    expect(decideDripEmail({ ...base(), hasHardwareClaim: true }, NOW)).toBeNull()
    expect(decideDripEmail({ ...base(), hardwareOfferActive: false }, NOW)).toBeNull()
  })
})

describe('check-ins (day 30+, inactive, 3 lifetime)', () => {
  const inactive = (sent: DripAgentState['sent'] = {}) =>
    state({
      createdAt: daysAgo(90),
      paidAccess: true, // hardware pitch out of the way
      openHouseCount: 2,
      lastOpenHouseActivityAt: daysAgo(45),
      sent: { referral: daysAgo(40), ...sent },
    })

  it('fires when there is no open-house activity for 30 days', () => {
    expect(decideDripEmail(inactive(), NOW)).toBe('checkin_1')
  })

  it('stays quiet when the agent is active or has an event scheduled', () => {
    expect(decideDripEmail({ ...inactive(), lastOpenHouseActivityAt: daysAgo(10) }, NOW)).toBeNull()
    expect(decideDripEmail({ ...inactive(), hasUpcomingOpenHouse: true }, NOW)).toBeNull()
  })

  it('spaces check-ins 30 days apart and stops after three', () => {
    expect(decideDripEmail(inactive({ checkin_1: daysAgo(10) }), NOW)).toBeNull()
    expect(decideDripEmail(inactive({ checkin_1: daysAgo(31) }), NOW)).toBe('checkin_2')
    expect(
      decideDripEmail(inactive({ checkin_1: daysAgo(70), checkin_2: daysAgo(35) }), NOW)
    ).toBe('checkin_3')
    expect(
      decideDripEmail(
        inactive({ checkin_1: daysAgo(100), checkin_2: daysAgo(70), checkin_3: daysAgo(40) }),
        NOW
      )
    ).toBeNull()
  })
})

describe('sequence ordering', () => {
  it('walks a stalled free agent through the whole sequence over weeks', () => {
    // Logged in day 0, never created an open house, offer active.
    const s = state({ createdAt: daysAgo(60) })
    expect(decideDripEmail(s, NOW)).toBe('first_open_house')
    s.sent.first_open_house = daysAgo(21)
    // No open house → referral never fires; hardware is next.
    expect(decideDripEmail(s, NOW)).toBe('hardware_offer')
    s.sent.hardware_offer = daysAgo(14)
    expect(decideDripEmail(s, NOW)).toBe('checkin_1')
  })
})
