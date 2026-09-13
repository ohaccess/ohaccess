import { describe, it, expect } from 'vitest'
import {
  computeInviteAudience,
  inviteWindowEnd,
  buildInviteEmail,
  normalizeEmail,
  INVITE_FREQUENCY_MAX,
  type InviteCandidate,
  type InviteEmailOpts,
} from '../lib/invite-helpers'

const TARGET_OH = 'oh-target'

// A visitor row with sane defaults; override per test.
const visitor = (over: Partial<InviteCandidate> = {}): InviteCandidate => ({
  first_name: 'Sarah',
  last_name: 'Lee',
  email: 'sarah@example.com',
  email_status: null,
  sms_opted_out: false,
  purchasing_timeline: '0–3 Months', // en-dash, matches TIMELINE_VALUES
  registered_at: '2026-07-01T18:00:00Z',
  open_house_id: 'oh-past',
  ...over,
})

const audience = (visitors: InviteCandidate[], over: Partial<Parameters<typeof computeInviteAudience>[0]> = {}) =>
  computeInviteAudience({
    visitors,
    targetOpenHouseId: TARGET_OH,
    optedOutEmails: new Set(),
    alreadyInvitedEmails: new Set(),
    recentInviteEmails: [],
    now: new Date('2026-07-26T00:00:00Z'),
    ...over,
  })

describe('inviteWindowEnd', () => {
  // Midday UTC keeps the local-time month arithmetic on the same calendar
  // day across DST shifts — the windows are month-scale, ±1h is irrelevant.
  it('maps each timeline to its padded window', () => {
    const reg = '2026-01-15T12:00:00Z'
    expect(inviteWindowEnd('0–3 Months', reg).toISOString()).toContain('2026-05-15')
    expect(inviteWindowEnd('3–6 Months', reg).toISOString()).toContain('2026-08-15')
    expect(inviteWindowEnd('6–12 Months', reg).toISOString()).toContain('2027-02-15')
    expect(inviteWindowEnd('12+ Months', reg).toISOString()).toContain('2027-05-15')
  })
  it('gives unknown or legacy timelines the shortest window', () => {
    const reg = '2026-01-15T12:00:00Z'
    expect(inviteWindowEnd(null, reg).toISOString()).toContain('2026-05-15')
    expect(inviteWindowEnd('0–1 Month', reg).toISOString()).toContain('2026-05-15')
  })
})

describe('computeInviteAudience', () => {
  it('matches a recent visitor inside their window', () => {
    const { matches, excluded } = audience([visitor()])
    expect(matches).toHaveLength(1)
    expect(matches[0].email).toBe('sarah@example.com')
    expect(Object.values(excluded).every(n => n === 0)).toBe(true)
  })

  it('excludes visitors past their timeline window', () => {
    // 0–3 Months answered ~5 months ago → past the 4-month window.
    const { matches, excluded } = audience([visitor({ registered_at: '2026-02-20T00:00:00Z' })])
    expect(matches).toHaveLength(0)
    expect(excluded.expired).toBe(1)
  })

  it('most recent sign-in wins: a repeat visit resets the clock and timeline', () => {
    const { matches } = audience([
      visitor({ registered_at: '2026-02-20T00:00:00Z', purchasing_timeline: '0–3 Months', open_house_id: 'oh-a' }),
      visitor({ registered_at: '2026-07-10T00:00:00Z', purchasing_timeline: '6–12 Months', open_house_id: 'oh-b' }),
    ])
    expect(matches).toHaveLength(1)
    expect(matches[0].timeline).toBe('6–12 Months')
    expect(matches[0].lastVisitOpenHouseId).toBe('oh-b')
  })

  it('a repeat visit can also EXTEND eligibility (expired old answer, fresh new one)', () => {
    const { matches, excluded } = audience([
      visitor({ registered_at: '2026-01-05T00:00:00Z', purchasing_timeline: '0–3 Months' }), // long expired
      visitor({ registered_at: '2026-07-01T00:00:00Z', purchasing_timeline: '12+ Months', open_house_id: 'oh-b' }),
    ])
    expect(matches).toHaveLength(1)
    expect(excluded.expired).toBe(0)
  })

  it('ignores visitors of the target open house', () => {
    const { matches, excluded } = audience([visitor({ open_house_id: TARGET_OH })])
    expect(matches).toHaveLength(0)
    expect(Object.values(excluded).every(n => n === 0)).toBe(true)
  })

  it('dedups by normalized email across visits', () => {
    const { matches } = audience([
      visitor({ email: ' Sarah@Example.com ' }),
      visitor({ email: 'sarah@example.com', registered_at: '2026-07-10T00:00:00Z', open_house_id: 'oh-b' }),
    ])
    expect(matches).toHaveLength(1)
  })

  it('excludes globally opted-out emails', () => {
    const { matches, excluded } = audience([visitor()], { optedOutEmails: new Set(['sarah@example.com']) })
    expect(matches).toHaveLength(0)
    expect(excluded.optedOut).toBe(1)
  })

  it('treats an SMS STOP on any visit as opted out', () => {
    const { matches, excluded } = audience([
      visitor({ sms_opted_out: true }),
      visitor({ registered_at: '2026-07-10T00:00:00Z', open_house_id: 'oh-b' }),
    ])
    expect(matches).toHaveLength(0)
    expect(excluded.optedOut).toBe(1)
  })

  it('excludes addresses with a bounced/complained/failed send on any visit', () => {
    const { matches, excluded } = audience([
      visitor({ email_status: 'bounced' }),
      visitor({ registered_at: '2026-07-10T00:00:00Z', open_house_id: 'oh-b' }),
    ])
    expect(matches).toHaveLength(0)
    expect(excluded.badEmail).toBe(1)
  })

  it('never invites twice for the same open house', () => {
    const { matches, excluded } = audience([visitor()], { alreadyInvitedEmails: new Set(['sarah@example.com']) })
    expect(matches).toHaveLength(0)
    expect(excluded.alreadyInvited).toBe(1)
  })

  it('applies the monthly frequency cap', () => {
    const recent = Array.from({ length: INVITE_FREQUENCY_MAX }, () => 'sarah@example.com')
    const { matches, excluded } = audience([visitor()], { recentInviteEmails: recent })
    expect(matches).toHaveLength(0)
    expect(excluded.frequencyCapped).toBe(1)
  })

  it('allows a send when under the frequency cap', () => {
    const { matches } = audience([visitor()], { recentInviteEmails: ['sarah@example.com'] })
    expect(matches).toHaveLength(1)
  })

  it('skips rows without an email', () => {
    const { matches, excluded } = audience([visitor({ email: null })])
    expect(matches).toHaveLength(0)
    expect(Object.values(excluded).every(n => n === 0)).toBe(true)
  })

  it('sorts soonest-expiring (hottest) buyers first', () => {
    const { matches } = audience([
      visitor({ email: 'later@example.com', purchasing_timeline: '12+ Months' }),
      visitor({ email: 'hot@example.com', purchasing_timeline: '0–3 Months', open_house_id: 'oh-b' }),
    ])
    expect(matches.map(m => m.email)).toEqual(['hot@example.com', 'later@example.com'])
  })
})

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Sarah@Example.COM ')).toBe('sarah@example.com')
    expect(normalizeEmail(null)).toBe('')
  })
})

describe('buildInviteEmail', () => {
  const opts: InviteEmailOpts = {
    appUrl: 'https://www.ohaccess.com',
    primary: '#1d1d1f', accent: '#0071e3', onPrimary: '#ffffff', onAccent: '#ffffff',
    visitorFirst: 'Sarah',
    pastStreet: '456 Elm St',
    agentName: 'Jane Rivera',
    brokerage: 'Reflect Real Estate',
    headshotUrl: null,
    agentPhone: '(555) 010-2030',
    agentEmail: 'jane@reflectre.com',
    oh: {
      id: 'oh-target',
      fullAddress: '123 Oak Street, Palo Alto, CA 94301',
      street: '123 Oak Street',
      dateLabel: 'Sat, Aug 1',
      hoursLabel: '2:00 PM – 4:00 PM',
      startAt: '2026-08-01T21:00:00Z',
      endAt: '2026-08-01T23:00:00Z',
      facts: '$1,895,000 · 4 bd · 3 ba',
      listingUrl: null,
    },
    unsubscribeUrl: 'https://www.ohaccess.com/unsubscribe?token=tok-123',
  }

  it('includes the Google Maps link for the property', () => {
    const { html } = buildInviteEmail(opts)
    expect(html).toContain('https://www.google.com/maps/search/?api=1&amp;query=123%20Oak%20Street')
  })

  it('includes Google, Outlook, and Apple calendar links', () => {
    const { html } = buildInviteEmail(opts)
    expect(html).toContain('calendar.google.com/calendar/render')
    expect(html).toContain('outlook.live.com/calendar')
    expect(html).toContain('/api/open-house/oh-target/calendar')
  })

  it('drops the calendar line without a start time', () => {
    const { html } = buildInviteEmail({ ...opts, oh: { ...opts.oh, startAt: null, endAt: null } })
    expect(html).not.toContain('Add to calendar')
  })

  it('includes the unsubscribe link and consent reason', () => {
    const { html } = buildInviteEmail(opts)
    expect(html).toContain('https://www.ohaccess.com/unsubscribe?token=tok-123')
    expect(html).toContain('agreed to hear about other properties')
  })

  it('references the visitor&apos;s past visit in the opener', () => {
    const { html } = buildInviteEmail(opts)
    expect(html).toContain('456 Elm St')
  })

  it('escapes agent-controlled strings', () => {
    const { html } = buildInviteEmail({ ...opts, agentName: 'Jane <script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert(1)')
  })

  it('puts the street and date in the subject', () => {
    const { subject } = buildInviteEmail(opts)
    expect(subject).toContain('123 Oak Street')
    expect(subject).toContain('Sat, Aug 1')
  })
})
