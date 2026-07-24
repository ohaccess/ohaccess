import { describe, it, expect } from 'vitest'
import { thankYouSendState, agentInitials, buildThankYouEmail, type ThankYouEmailOpts } from '../lib/thank-you-email'

// registered at 3:00 PM local in America/Chicago (CDT, UTC-5) on Jul 24.
const REGISTERED = '2026-07-24T20:00:00Z'
const TZ = 'America/Chicago'

describe('thankYouSendState', () => {
  it('waits during the visit day', () => {
    expect(thankYouSendState(REGISTERED, TZ, new Date('2026-07-24T23:00:00Z'))).toBe('wait') // 6pm local, same day
  })
  it('waits before 9am the next morning', () => {
    expect(thankYouSendState(REGISTERED, TZ, new Date('2026-07-25T13:00:00Z'))).toBe('wait') // 8am local next day
  })
  it('sends at/after 9am the next morning', () => {
    expect(thankYouSendState(REGISTERED, TZ, new Date('2026-07-25T15:00:00Z'))).toBe('send') // 10am local next day
  })
  it('skips once the next-morning window has passed', () => {
    expect(thankYouSendState(REGISTERED, TZ, new Date('2026-07-26T15:00:00Z'))).toBe('skip') // two days later
  })
  it('falls back to Central time when no timezone is stored', () => {
    expect(thankYouSendState(REGISTERED, null, new Date('2026-07-25T15:00:00Z'))).toBe('send')
  })
})

describe('agentInitials', () => {
  it('takes first + last initial', () => {
    expect(agentInitials('Kathryn Chen')).toBe('KC')
    expect(agentInitials('  Mary  Jane  Watson ')).toBe('MW')
  })
  it('handles a single name', () => {
    expect(agentInitials('Cher')).toBe('C')
  })
  it('handles empty', () => {
    expect(agentInitials('')).toBe('')
    expect(agentInitials(null)).toBe('')
  })
})

const baseOpts: ThankYouEmailOpts = {
  appUrl: 'https://www.ohaccess.com',
  primary: '#1d1d1f', accent: '#c9a227', onPrimary: '#ffffff', onAccent: '#1d1d1f',
  visitorFirst: 'Sarah', street: '4124 Cory Lee Court', city: 'Arlington',
  fullAddress: '4124 Cory Lee Court, Arlington, TX', dateLabel: 'Jul 24, 2026',
  agentName: 'Kathryn Chen', brokerage: 'Reflect Real Estate',
  headshotUrl: null, agentLogoUrl: null, agentPhone: '(817) 555-0142', agentEmail: 'kathryn@reflectre.com',
  listingUrl: null, facts: null, upcomingHtml: '', sponsor: null,
}

describe('buildThankYouEmail', () => {
  it('subject names the street and body says yesterday', () => {
    const { subject, html } = buildThankYouEmail(baseOpts)
    expect(subject).toBe('Thanks for visiting 4124 Cory Lee Court')
    expect(html).toContain('yesterday')
    expect(html).toContain('Kathryn Chen')
  })

  it('omits listing, upcoming and sponsor sections when there is no data', () => {
    const { html } = buildThankYouEmail(baseOpts)
    expect(html).not.toContain('The home you visited')
    expect(html).not.toContain('View the listing')
    expect(html).not.toContain('Sponsored by')
  })

  it('shows listing link, upcoming and sponsor when present', () => {
    const { html } = buildThankYouEmail({
      ...baseOpts,
      listingUrl: 'https://example.com/listing',
      facts: '$625,000 · 4 bd · 3 ba',
      upcomingHtml: '<div>Upcoming Open Houses</div>',
      sponsor: { name: 'Mark Alvarez', company: 'Summit Home Loans', email: null, phone: '(817) 555-0199', logoUrl: null },
    })
    expect(html).toContain('View the listing')
    expect(html).toContain('The home you visited')
    expect(html).toContain('Upcoming Open Houses')
    expect(html).toContain('Sponsored by')
    expect(html).toContain('free to shop around')
  })

  it('escapes visitor/agent-controlled values', () => {
    const { html } = buildThankYouEmail({ ...baseOpts, visitorFirst: '<script>x</script>' })
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('drops the " in <city>" clause when city is missing', () => {
    const { html } = buildThankYouEmail({ ...baseOpts, city: null })
    expect(html).not.toContain(' in <strong></strong>')
  })
})
