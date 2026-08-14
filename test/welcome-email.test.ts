import { describe, it, expect } from 'vitest'
import {
  buildWelcomeEmail,
  welcomeFirstName,
  WELCOME_VIDEO_SETTINGS,
  WELCOME_VIDEO_OPEN_HOUSE,
} from '../lib/welcome-email'

const APP_URL = 'https://www.ohaccess.com'

describe('welcomeFirstName', () => {
  it('prefers the profile full name', () => {
    expect(welcomeFirstName('Kathryn Chen', { full_name: 'Other Person' })).toBe('Kathryn')
  })
  it('falls back to auth metadata full_name, then name', () => {
    expect(welcomeFirstName('', { full_name: 'Marcus Lee' })).toBe('Marcus')
    expect(welcomeFirstName(null, { name: 'Dana Kowalski' })).toBe('Dana')
  })
  it('returns empty when nothing usable exists', () => {
    expect(welcomeFirstName(null, undefined)).toBe('')
    expect(welcomeFirstName('   ', {})).toBe('')
  })
})

describe('buildWelcomeEmail', () => {
  it('has the approved subject', () => {
    const { subject } = buildWelcomeEmail({ firstName: 'Kathryn', appUrl: APP_URL })
    expect(subject).toBe('Welcome to ohACCESS — your first open house is 10 minutes away')
  })

  it('greets by first name, falling back to "there"', () => {
    expect(buildWelcomeEmail({ firstName: 'Kathryn', appUrl: APP_URL }).html).toContain('Hi Kathryn,')
    expect(buildWelcomeEmail({ firstName: '', appUrl: APP_URL }).html).toContain('Hi there,')
    expect(buildWelcomeEmail({ firstName: null, appUrl: APP_URL }).html).toContain('Hi there,')
  })

  it('escapes a hostile first name', () => {
    const { html } = buildWelcomeEmail({ firstName: '<script>x</script>', appUrl: APP_URL })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('links both tutorial videos and both dashboard views', () => {
    const { html } = buildWelcomeEmail({ firstName: 'Kathryn', appUrl: APP_URL })
    expect(html).toContain(WELCOME_VIDEO_SETTINGS)
    expect(html).toContain(WELCOME_VIDEO_OPEN_HOUSE)
    expect(html).toContain(`${APP_URL}/dashboard?view=settings`)
    expect(html).toContain(`${APP_URL}/dashboard?view=new`)
  })

  it('carries the key approved copy points', () => {
    const { html } = buildWelcomeEmail({ firstName: 'Kathryn', appUrl: APP_URL })
    expect(html).toContain('legible names, real phone numbers, real leads')
    expect(html).toContain('25 visitor sign-ins are free')
    expect(html).toContain('codewords')
    expect(html).not.toMatch(/code words/i) // "codeword" is one word everywhere
    expect(html).toContain('💌 Invite')
    expect(html).toContain('Just hit reply')
  })
})
