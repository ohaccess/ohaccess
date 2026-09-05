import { describe, it, expect } from 'vitest'
import {
  buildFinishSetupEmail,
  buildFirstOpenHouseEmail,
  buildReferralEmail,
  buildHardwareOfferEmail,
  buildCheckinEmail,
} from '../lib/drip-emails'
import { WELCOME_VIDEO_SETTINGS, WELCOME_VIDEO_OPEN_HOUSE } from '../lib/welcome-email'

const APP_URL = 'https://www.ohaccess.com'
const UNSUB = `${APP_URL}/unsubscribe?agent=tok-123`
const base = { firstName: 'Kathryn', appUrl: APP_URL, unsubscribeUrl: UNSUB }

const ALL = [
  buildFinishSetupEmail(base),
  buildFirstOpenHouseEmail(base),
  buildReferralEmail({ ...base, referralUrl: 'https://ohaccess.com/r/abc123XY' }),
  buildHardwareOfferEmail(base),
  buildCheckinEmail(base),
]

describe('every drip email', () => {
  it('carries the visible unsubscribe link and the no-transactional-impact note', () => {
    for (const { html } of ALL) {
      expect(html).toContain(UNSUB)
      expect(html).toContain('Unsubscribe')
      expect(html).toContain('reminders, reports')
    }
  })

  it('greets by first name, falling back to "there"', () => {
    for (const { html } of ALL) expect(html).toContain('Hi Kathryn,')
    expect(buildCheckinEmail({ ...base, firstName: null }).html).toContain('Hi there,')
  })

  it('escapes a hostile first name', () => {
    const { html } = buildCheckinEmail({ ...base, firstName: '<script>x</script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('signs off from Dave with a reply invitation', () => {
    for (const { html } of ALL) {
      expect(html).toContain('Dave Sheehan')
      expect(html).toContain('hit reply')
    }
  })
})

describe('buildFinishSetupEmail', () => {
  it('links to login and the settings video', () => {
    const { subject, html } = buildFinishSetupEmail(base)
    expect(subject).toBe('Your ohACCESS account is ready — pick up where you left off')
    expect(html).toContain(`${APP_URL}/login`)
    expect(html).toContain(WELCOME_VIDEO_SETTINGS)
    expect(html).toContain('25 visitor sign-ins are free')
  })
})

describe('buildFirstOpenHouseEmail', () => {
  it('links to New Open House and the open-house video', () => {
    const { html } = buildFirstOpenHouseEmail(base)
    expect(html).toContain(`${APP_URL}/dashboard?view=new`)
    expect(html).toContain(WELCOME_VIDEO_OPEN_HOUSE)
  })
})

describe('buildReferralEmail', () => {
  it('shows the agent-specific link and the reward terms', () => {
    const { html } = buildReferralEmail({ ...base, referralUrl: 'https://ohaccess.com/r/abc123XY' })
    expect(html).toContain('https://ohaccess.com/r/abc123XY')
    expect(html).toContain('a free month')
    expect(html).toContain('$15 credit')
  })
})

describe('buildHardwareOfferEmail', () => {
  it('pitches the 2-year offer with the terms link', () => {
    const { html } = buildHardwareOfferEmail(base)
    expect(html).toContain('first 100 agents in your state')
    expect(html).toContain('$240')
    expect(html).toContain(`${APP_URL}/dashboard?view=settings`)
    expect(html).toContain(`${APP_URL}/subscriber-terms`)
  })
})

describe('buildCheckinEmail', () => {
  it('links the setup flow and the video', () => {
    const { subject, html } = buildCheckinEmail(base)
    expect(subject).toBe('Holding an open house soon?')
    expect(html).toContain(`${APP_URL}/dashboard?view=new`)
    expect(html).toContain(WELCOME_VIDEO_OPEN_HOUSE)
  })
})
