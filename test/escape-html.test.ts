import { describe, it, expect } from 'vitest'
import { escapeHtml, escapeAttr } from '@/lib/escape-html'

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })
  it('escapes ampersands first so entities are not double-broken', () => {
    expect(escapeHtml('a & <b>')).toBe('a &amp; &lt;b&gt;')
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })
  it('neutralizes an attribute-breakout injection attempt', () => {
    const out = escapeHtml('"><img src=x onerror=alert(1)>')
    expect(out).not.toContain('<img')
    expect(out).not.toContain('">')
  })
  it('returns an empty string for null / undefined', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
  it('escapeAttr behaves like escapeHtml', () => {
    expect(escapeAttr('<x>')).toBe(escapeHtml('<x>'))
  })
})
