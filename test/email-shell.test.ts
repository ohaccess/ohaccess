import { describe, it, expect } from 'vitest'
import { resolveEmailBranding, brandedEmailShell, emailButton, emailEyebrow } from '../lib/email-shell'

describe('resolveEmailBranding', () => {
  it('falls back to the ohACCESS defaults', () => {
    expect(resolveEmailBranding(null, null)).toMatchObject({ primary: '#1d1d1f', accent: '#0071e3', onPrimary: '#ffffff', logoUrl: null })
  })
  it('takes the team primary + logo, and the agent accent first', () => {
    const b = resolveEmailBranding(
      { primary_color: '#111111', accent_color: '#ff6600', logo_url: 'https://example.com/a.png' },
      { primary_color: '#445566', accent_color: '#00aa00', logo_url: 'https://example.com/team.png' }
    )
    expect(b).toMatchObject({ primary: '#445566', accent: '#ff6600', logoUrl: 'https://example.com/team.png' })
  })
  it('uses the team accent when the agent has none', () => {
    expect(resolveEmailBranding({}, { accent_color: '#00aa00' }).accent).toBe('#00aa00')
  })
  it('rejects anything that is not a hex color', () => {
    expect(resolveEmailBranding({ primary_color: 'red;"><script>', accent_color: 'url(x)' }, null)).toMatchObject({ primary: '#1d1d1f', accent: '#0071e3' })
  })
})

describe('brandedEmailShell', () => {
  it('keeps header text readable on a light primary', () => {
    const html = brandedEmailShell({ brand: { primary: '#ffffff', onPrimary: '#1d1d1f' }, headerTitleHtml: 'Title', bodyHtml: 'Body', footerHtml: '' })
    expect(html).toContain('background:#ffffff')
    expect(html).toContain('color:#1d1d1f;">oh')
    expect(html).toContain('Patent Pending')
  })
  it('keeps accent text readable on white, and buttons filled with the accent', () => {
    expect(emailEyebrow('Label', '#ffffff')).toContain('color:#1d1d1f')
    const btn = emailButton('Go', 'https://example.com', { accent: '#ffffff', onAccent: '#1d1d1f' })
    expect(btn).toContain('background:#ffffff')
    expect(btn).toContain('color:#1d1d1f')
  })
})
