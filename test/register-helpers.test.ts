import { describe, it, expect } from 'vitest'
import {
  generateCode,
  buildSmsBody,
  isHttpUrl,
  safeUrl,
  isHexColor,
  isEmail,
  buildCrmLeadEmail,
  agentCopyRecipients,
  SMS_MAX_LENGTH,
} from '@/lib/register-helpers'

describe('generateCode', () => {
  it('produces an 8-char alphanumeric slug', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCode()).toMatch(/^[a-zA-Z0-9]{8}$/)
    }
  })
})

describe('buildSmsBody', () => {
  it('returns the base unchanged when there are no extras', () => {
    expect(buildSmsBody('Your code is CATDOG', [])).toBe('Your code is CATDOG')
  })
  it('appends an extra link when it fits within the SMS budget', () => {
    const out = buildSmsBody('Your code is CATDOG', [{ label: 'View', url: 'https://a.co/x' }])
    expect(out).toBe('Your code is CATDOG View: https://a.co/x')
    expect(out.length).toBeLessThanOrEqual(SMS_MAX_LENGTH)
  })
  it('drops an extra that would exceed SMS_MAX_LENGTH', () => {
    const base = 'x'.repeat(150)
    const out = buildSmsBody(base, [{ label: 'View', url: 'https://example.com/listing' }])
    expect(out).toBe(base)
  })
  it('never exceeds the SMS budget even with several extras', () => {
    const base = 'Code CATDOG'
    const out = buildSmsBody(base, [
      { label: 'A', url: 'https://a.co/' + 'a'.repeat(200) },
      { label: 'B', url: 'https://b.co/short' },
    ])
    expect(out.length).toBeLessThanOrEqual(SMS_MAX_LENGTH)
    expect(out).toContain('B: https://b.co/short') // the one that fits still lands
  })
})

describe('isHttpUrl / safeUrl', () => {
  it('accepts only http(s) URLs', () => {
    expect(isHttpUrl('http://x.co')).toBe(true)
    expect(isHttpUrl('https://x.co')).toBe(true)
    expect(isHttpUrl('HTTPS://X.CO')).toBe(true)
  })
  it('rejects dangerous / non-web schemes and empties', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('data:text/html,<script>')).toBe(false)
    expect(isHttpUrl('ftp://x.co')).toBe(false)
    expect(isHttpUrl('')).toBe(false)
    expect(isHttpUrl(null)).toBe(false)
  })
  it('safeUrl returns the URL when valid and empty string otherwise', () => {
    expect(safeUrl('https://x.co')).toBe('https://x.co')
    expect(safeUrl('javascript:alert(1)')).toBe('')
    expect(safeUrl(null)).toBe('')
  })
})

describe('isHexColor', () => {
  it('accepts 3-to-8 digit hex colors', () => {
    expect(isHexColor('#fff')).toBe(true)
    expect(isHexColor('#ffffff')).toBe(true)
    expect(isHexColor('#12345678')).toBe(true)
  })
  it('rejects malformed or over-long values', () => {
    expect(isHexColor('#12')).toBe(false)
    expect(isHexColor('#123456789')).toBe(false)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor('#gghhii')).toBe(false)
    expect(isHexColor(null)).toBe(false)
  })
})

describe('isEmail', () => {
  it('accepts a plausible email and trims surrounding whitespace', () => {
    expect(isEmail('lead@example.com')).toBe(true)
    expect(isEmail('  lead@example.com  ')).toBe(true)
  })
  it('rejects malformed addresses', () => {
    expect(isEmail('no-at-sign')).toBe(false)
    expect(isEmail('missing@domain')).toBe(false)
    expect(isEmail('two spaces@x.co')).toBe(false)
    expect(isEmail(null)).toBe(false)
  })
})

describe('buildCrmLeadEmail', () => {
  const base = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+14158675309',
    purchasingTimeline: '3-6 months',
    propertyAddress: '1 Main St',
    agentName: 'Agent Smith',
    registeredAt: '2026-07-01',
    visitorUrl: 'https://ohaccess.com/visitor/abc',
  }

  it('includes the labeled lead fields CRMs parse', () => {
    const html = buildCrmLeadEmail(base)
    expect(html).toContain('Name: Jane Doe')
    expect(html).toContain('Email: jane@example.com')
    expect(html).toContain('lead_name')
  })

  it('escapes attacker-controlled fields (no raw HTML injection)', () => {
    const html = buildCrmLeadEmail({ ...base, firstName: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('agentCopyRecipients', () => {
  it('CCs the display email and BCCs the login email when both are set and differ', () => {
    expect(agentCopyRecipients('public@agent.com', 'login@agent.com')).toEqual({
      cc: ['public@agent.com'],
      bcc: ['login@agent.com'],
    })
  })
  it('dedupes when display and login are the same address (no double send)', () => {
    expect(agentCopyRecipients('same@agent.com', 'same@agent.com')).toEqual({
      cc: ['same@agent.com'],
      bcc: [],
    })
  })
  it('falls back to the login email for the CC when no display email is set', () => {
    expect(agentCopyRecipients('', 'login@agent.com')).toEqual({
      cc: ['login@agent.com'],
      bcc: [],
    })
    expect(agentCopyRecipients(null, 'login@agent.com')).toEqual({
      cc: ['login@agent.com'],
      bcc: [],
    })
  })
  it('CCs the display email and adds no BCC when there is no login email', () => {
    expect(agentCopyRecipients('public@agent.com', null)).toEqual({
      cc: ['public@agent.com'],
      bcc: [],
    })
  })
  it('never exposes the login email as a visible CC when a display email exists', () => {
    const { cc } = agentCopyRecipients('public@agent.com', 'login@agent.com')
    expect(cc).not.toContain('login@agent.com')
  })
  it('drops invalid addresses and trims whitespace', () => {
    expect(agentCopyRecipients('not-an-email', 'login@agent.com')).toEqual({
      cc: ['login@agent.com'],
      bcc: [],
    })
    expect(agentCopyRecipients('  public@agent.com  ', '  login@agent.com  ')).toEqual({
      cc: ['public@agent.com'],
      bcc: ['login@agent.com'],
    })
    expect(agentCopyRecipients(null, null)).toEqual({ cc: [], bcc: [] })
  })
})
