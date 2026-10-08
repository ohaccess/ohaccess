import { describe, it, expect } from 'vitest'
import {
  UTM_COOKIE,
  attributionFromUrl,
  attributionLabel,
  attributionProfileFields,
  encodeUtmCookieValue,
  parseUtmCookie,
  readCookie,
  sanitizeAttribution,
} from '../lib/attribution'

describe('attributionFromUrl', () => {
  it('captures the utm_* fields and the landing page', () => {
    const a = attributionFromUrl('?utm_source=facebook&utm_medium=paid&utm_campaign=oct-safety&utm_content=reel-3&utm_term=open%20house', '/blog/why-verify')
    expect(a).toEqual({
      utm_source: 'facebook', utm_medium: 'paid', utm_campaign: 'oct-safety', utm_content: 'reel-3', utm_term: 'open house',
      landing_page: '/blog/why-verify',
    })
  })
  it('returns null when the URL has no utm_* at all', () => {
    expect(attributionFromUrl('?ref=jane&fbclid=abc', '/')).toBeNull()
    expect(attributionFromUrl('', '/')).toBeNull()
  })
  it('strips markup characters and caps the length', () => {
    const a = attributionFromUrl(`?utm_source=${encodeURIComponent('<script>x</script>')}&utm_campaign=${'a'.repeat(500)}`, '/')
    expect(a?.utm_source).toBe('scriptx/script')
    expect(a?.utm_campaign).toHaveLength(120)
  })
  it('keeps only a safe path for the landing page', () => {
    expect(attributionFromUrl('?utm_source=x', '/blog/<b>')?.landing_page).toBe('/blog/b')
    expect(attributionFromUrl('?utm_source=x', 'not-a-path')?.landing_page).toBeUndefined()
  })
})

describe('cookie round trip', () => {
  it('encodes to a cookie value and parses it back, re-validating fields', () => {
    const a = { utm_source: 'instagram', utm_campaign: 'dm-friday', landing_page: '/' }
    const cookie = `other=1; ${UTM_COOKIE}=${encodeUtmCookieValue(a)}; _fbp=fb.1.2.3`
    expect(parseUtmCookie(cookie)).toEqual(a)
    expect(readCookie(cookie, '_fbp')).toBe('fb.1.2.3')
    expect(readCookie(cookie, 'missing')).toBeNull()
  })
  it('ignores a malformed or empty cookie', () => {
    expect(parseUtmCookie(`${UTM_COOKIE}=%7Bnot-json`)).toBeNull()
    expect(parseUtmCookie(`${UTM_COOKIE}=${encodeURIComponent('{"foo":"bar"}')}`)).toBeNull()
    expect(parseUtmCookie(undefined)).toBeNull()
  })
})

describe('sanitizeAttribution / profile fields / label', () => {
  it('reads attribution out of auth user_metadata alongside other keys', () => {
    const a = sanitizeAttribution({ referral_source: 'jane', utm_source: 'google', utm_medium: 'cpc', landing_page: '/faq', extra: 1 })
    expect(a).toEqual({ utm_source: 'google', utm_medium: 'cpc', landing_page: '/faq' })
    expect(sanitizeAttribution({ referral_source: 'jane' })).toBeNull()
    expect(sanitizeAttribution(null)).toBeNull()
  })
  it('maps to the profiles columns and nothing else', () => {
    expect(attributionProfileFields({ utm_source: 'x', landing_page: '/p' })).toEqual({ utm_source: 'x', landing_page: '/p' })
    expect(attributionProfileFields(null)).toEqual({})
  })
  it('labels as source / medium / campaign, skipping blanks', () => {
    expect(attributionLabel({ utm_source: 'facebook', utm_campaign: 'oct' })).toBe('facebook / oct')
    expect(attributionLabel({ utm_source: 'facebook', utm_medium: 'paid', utm_campaign: 'oct' })).toBe('facebook / paid / oct')
    expect(attributionLabel(null)).toBe('')
  })
})
