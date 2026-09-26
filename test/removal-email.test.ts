import { describe, it, expect } from 'vitest'
import { buildRemovalEmail } from '../lib/removal-email'

const base = { firstName: 'Dana', groupName: 'Reflect Team', trialLimit: 25, appUrl: 'https://www.ohaccess.com' }

describe('buildRemovalEmail', () => {
  it('team removal with trial registrations left: says how many remain', () => {
    const { subject, html } = buildRemovalEmail({ ...base, kind: 'team', visitorsUsed: 10, hasOwnPaidAccess: false })
    expect(subject).toBe("You've been removed from Reflect Team on ohACCESS")
    expect(html).toContain('Hi Dana,')
    expect(html).toContain('has removed you from its ohACCESS team')
    expect(html).toContain('Nothing has been deleted')
    expect(html).toContain('<strong>10 of 25</strong>')
    expect(html).toContain('<strong>15</strong> left')
    expect(html).toContain('Open my dashboard')
    expect(html).toContain('https://www.ohaccess.com/dashboard?view=settings')
    expect(html).not.toContain('Choose a plan')
  })

  it('team removal already past the cap: prompts to choose a plan', () => {
    const { html } = buildRemovalEmail({ ...base, kind: 'team', visitorsUsed: 31, hasOwnPaidAccess: false })
    expect(html).toContain('already used all <strong>25</strong>')
    expect(html).toContain('paused until you choose a plan')
    expect(html).toContain('Choose a plan')
    expect(html).not.toContain('Open my dashboard')
  })

  it('exactly at the cap counts as past it', () => {
    const { html } = buildRemovalEmail({ ...base, kind: 'team', visitorsUsed: 25, hasOwnPaidAccess: false })
    expect(html).toContain('Choose a plan')
  })

  it('sponsor removal for an agent on their own paid plan: nothing else changes', () => {
    const { subject, html } = buildRemovalEmail({ ...base, kind: 'sponsor', groupName: 'Acme Mortgage', visitorsUsed: 400, hasOwnPaidAccess: true })
    expect(subject).toBe('Acme Mortgage is no longer sponsoring your ohACCESS account')
    expect(html).toContain('has ended its sponsorship')
    expect(html).toContain('no longer be shared with them')
    expect(html).toContain('keeps everything running exactly as before')
    expect(html).not.toContain('free trial')
    expect(html).not.toContain('Choose a plan')
  })

  it('escapes the group name and falls back to a generic greeting', () => {
    const { subject, html } = buildRemovalEmail({ ...base, firstName: '', kind: 'team', groupName: '<b>Evil</b> & Co', visitorsUsed: 0, hasOwnPaidAccess: false })
    expect(html).toContain('Hi there,')
    expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt; &amp; Co')
    expect(html).not.toContain('<b>Evil</b>')
    expect(subject).toContain('<b>Evil</b> & Co') // subjects are plain text, not HTML
  })

  it('counts a bonus-raised limit', () => {
    const { html } = buildRemovalEmail({ ...base, kind: 'team', trialLimit: 40, visitorsUsed: 30, hasOwnPaidAccess: false })
    expect(html).toContain('<strong>30 of 40</strong>')
    expect(html).toContain('<strong>10</strong> left')
  })
})
