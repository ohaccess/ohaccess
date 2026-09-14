import { describe, it, expect } from 'vitest'
import {
  buildSignInMatcher,
  groupWalkaways,
  type EventInfo,
  type RegistrationInput,
  type ScanInput,
} from '@/lib/scan-walkaways'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36'
const IMESSAGE_PREVIEW =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0'

// Open house 1: Sat Sep 12, 16:00 to 19:00 UTC. Sign-in closes 6h after the end.
const EVENT: EventInfo = { start_at: '2026-09-12T16:00:00Z', end_at: '2026-09-12T19:00:00Z', deleted: false, visitorCount: null }

const scan = (over: Partial<ScanInput> = {}): ScanInput => ({
  open_house_id: 'oh1',
  agent_id: 'agent1',
  ip_address: '203.0.113.5',
  user_agent: IPHONE,
  created_at: '2026-09-12T17:00:00Z',
  ...over,
})

const visitor = (over: Partial<RegistrationInput> = {}): RegistrationInput => ({
  open_house_id: 'oh1',
  agent_id: 'agent1',
  ip_address: '198.51.100.9',
  user_agent: IPHONE,
  registered_at: '2026-09-12T17:04:00Z',
  ...over,
})

const group = (
  scans: ScanInput[],
  opts: { visitors?: RegistrationInput[]; events?: Map<string, EventInfo>; signupIps?: Map<string, Set<string>> } = {}
) => {
  const visitors = opts.visitors || []
  return groupWalkaways(scans, {
    visitors,
    events: opts.events || new Map([['oh1', EVENT]]),
    agentSignupIps: opts.signupIps || new Map(),
    isSignedIn: buildSignInMatcher(visitors),
  })
}

describe('buildSignInMatcher', () => {
  it('matches the same IP at the same open house', () => {
    const isSignedIn = buildSignInMatcher([visitor({ ip_address: '203.0.113.5', user_agent: ANDROID })])
    expect(isSignedIn(scan())).toBe(true)
  })
  it('matches the same browser signing in within 30 minutes when the IP changed (Private Relay)', () => {
    const isSignedIn = buildSignInMatcher([visitor({ registered_at: '2026-09-12T17:29:00Z' })])
    expect(isSignedIn(scan())).toBe(true)
  })
  it('does not match the same browser outside the window', () => {
    expect(buildSignInMatcher([visitor({ registered_at: '2026-09-12T17:45:00Z' })])(scan())).toBe(false)
    expect(buildSignInMatcher([visitor({ registered_at: '2026-09-12T16:50:00Z' })])(scan())).toBe(false)
  })
  it('does not match a different browser, or a sign-in at another open house', () => {
    expect(buildSignInMatcher([visitor({ user_agent: ANDROID })])(scan())).toBe(false)
    expect(buildSignInMatcher([visitor({ open_house_id: 'oh2', ip_address: '203.0.113.5' })])(scan())).toBe(false)
  })
})

describe('groupWalkaways tags', () => {
  const tagOf = (s: ScanInput, opts?: Parameters<typeof group>[1]) => group([s], opts)[0]?.tag

  it('places a scan against the event schedule', () => {
    expect(tagOf(scan({ created_at: '2026-09-10T12:00:00Z' }))).toBe('before')
    expect(tagOf(scan({ created_at: '2026-09-12T18:59:00Z' }))).toBe('during')
    expect(tagOf(scan({ created_at: '2026-09-12T21:00:00Z' }))).toBe('after')
    expect(tagOf(scan({ created_at: '2026-09-13T01:00:01Z' }))).toBe('closed')
  })
  it('tags link previews (iMessage fetches a texted link)', () => {
    expect(tagOf(scan({ user_agent: IMESSAGE_PREVIEW }))).toBe('preview')
  })
  it("tags the agent's own device as test: their signup IP, or a device that signed in at their other open house", () => {
    expect(tagOf(scan(), { signupIps: new Map([['agent1', new Set(['203.0.113.5'])]]) })).toBe('test')
    const elsewhere = visitor({ open_house_id: 'oh2', ip_address: '203.0.113.5', user_agent: ANDROID })
    expect(tagOf(scan(), { visitors: [elsewhere] })).toBe('test')
    // Another agent's open house doesn't count.
    expect(tagOf(scan(), { visitors: [{ ...elsewhere, agent_id: 'agent2' }] })).toBe('during')
  })
  it('handles deleted open houses', () => {
    const archived = (visitorCount: number) =>
      new Map([['oh1', { ...EVENT, deleted: true, visitorCount }]])
    expect(tagOf(scan(), { events: new Map() })).toBe('deleted') // deleted before the archive existed
    expect(tagOf(scan(), { events: archived(0) })).toBe('test') // never had a sign-in
    expect(tagOf(scan(), { events: archived(5) })).toBe('during') // a real event, schedule known
  })
  it('cannot place a legacy open house with no end time once it starts', () => {
    const legacy = new Map([['oh1', { ...EVENT, end_at: null }]])
    expect(tagOf(scan(), { events: legacy })).toBe('unknown')
    expect(tagOf(scan({ created_at: '2026-09-10T12:00:00Z' }), { events: legacy })).toBe('before')
  })
})

describe('groupWalkaways grouping', () => {
  it('collapses repeat loads from one device into one row, newest first', () => {
    const rows = group([
      scan({ created_at: '2026-09-13T02:00:00Z' }),
      scan({ created_at: '2026-09-12T17:00:00Z' }),
      scan({ created_at: '2026-09-12T20:00:00Z' }),
      scan({ ip_address: '192.0.2.44', user_agent: ANDROID, created_at: '2026-09-12T18:00:00Z' }),
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ count: 3, firstAt: '2026-09-12T17:00:00Z', lastAt: '2026-09-13T02:00:00Z' })
    expect(rows[1]).toMatchObject({ count: 1, tag: 'during' })
  })
  it('shows During event when any repeat load happened during the event', () => {
    const rows = group([scan({ created_at: '2026-09-13T02:00:00Z' }), scan({ created_at: '2026-09-12T17:00:00Z' })])
    expect(rows[0].tag).toBe('during')
  })
  it('leaves out scans that became a sign-in', () => {
    expect(group([scan()], { visitors: [visitor()] })).toHaveLength(0)
  })
})
