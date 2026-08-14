import { describe, it, expect } from 'vitest'
import { agentInGoodStanding, buildExpiredLeadEmail } from '@/lib/expired-lead'

// Standing rules mirror the register route: paid tier (not prepaid-expired)
// or a paying sponsor is always good; otherwise good only under the trial cap.
describe('agentInGoodStanding', () => {
  const free = { tier: 'free' }

  it('free agent under the trial cap is in good standing', () => {
    expect(agentInGoodStanding(free, false, 0)).toBe(true)
    expect(agentInGoodStanding(free, false, 24)).toBe(true)
  })

  it('free agent at or over the trial cap is lapsed', () => {
    expect(agentInGoodStanding(free, false, 25)).toBe(false)
    expect(agentInGoodStanding(free, false, 100)).toBe(false)
  })

  it('admin-gifted bonus visitors raise the cap', () => {
    const gifted = { tier: 'free', bonus_visitors: 10 }
    expect(agentInGoodStanding(gifted, false, 30)).toBe(true)
    expect(agentInGoodStanding(gifted, false, 35)).toBe(false)
  })

  it('paid tiers are good standing regardless of visitor count', () => {
    for (const tier of ['pro', 'team', 'brokerage']) {
      expect(agentInGoodStanding({ tier }, false, 10_000)).toBe(true)
    }
  })

  it('an expired comp reads as free and falls back to the trial cap', () => {
    const expiredComp = {
      tier: 'pro',
      billing_interval: 'comped',
      stripe_subscription_id: null,
      current_period_end: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    }
    expect(agentInGoodStanding(expiredComp, false, 25)).toBe(false)
    expect(agentInGoodStanding(expiredComp, false, 0)).toBe(true)
  })

  it('an active comp is good standing', () => {
    const activeComp = {
      tier: 'pro',
      billing_interval: 'comped',
      stripe_subscription_id: null,
      current_period_end: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    }
    expect(agentInGoodStanding(activeComp, false, 10_000)).toBe(true)
  })

  it('an expired legacy 2-year prepay falls back to the trial cap', () => {
    const expiredPrepay = {
      tier: 'pro',
      billing_interval: 'two_year_prepay',
      stripe_subscription_id: null,
      current_period_end: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    }
    expect(agentInGoodStanding(expiredPrepay, false, 25)).toBe(false)
  })

  it('a paying sponsor covers a lapsed free agent', () => {
    expect(agentInGoodStanding(free, true, 10_000)).toBe(true)
  })

  it('missing profile is never good standing', () => {
    expect(agentInGoodStanding(null, false, 0)).toBe(false)
    expect(agentInGoodStanding(undefined, true, 0)).toBe(false)
  })
})

describe('buildExpiredLeadEmail', () => {
  const lead = {
    name: 'Jane Buyer',
    email: 'jane@example.com',
    phone: '(555) 123-4567',
    zip: '76013',
  }

  it('includes the property address in the subject and body when known', () => {
    const { subject, html } = buildExpiredLeadEmail(
      { fullName: 'Dave Sheehan', propertyAddress: '123 Main St, Arlington, TX' },
      lead
    )
    expect(subject).toContain('123 Main St, Arlington, TX')
    expect(html).toContain('123 Main St, Arlington, TX')
    expect(html).toContain('Dave Sheehan')
  })

  it('omits the address gracefully when unknown', () => {
    const { subject, html } = buildExpiredLeadEmail(
      { fullName: null, propertyAddress: null },
      lead
    )
    expect(subject).toBe('🏠 Buyer lead from your open house QR')
    expect(html).toContain('Hi there')
  })

  it('carries every lead field and a mailto link', () => {
    const { html } = buildExpiredLeadEmail(
      { fullName: 'Dave', propertyAddress: null },
      lead
    )
    expect(html).toContain('Jane Buyer')
    expect(html).toContain('mailto:jane@example.com')
    expect(html).toContain('(555) 123-4567')
    expect(html).toContain('76013')
  })

  it('escapes HTML in visitor-supplied values', () => {
    const { html } = buildExpiredLeadEmail(
      { fullName: 'Dave', propertyAddress: null },
      { ...lead, name: '<script>alert(1)</script>' }
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
