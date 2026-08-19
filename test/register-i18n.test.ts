import { describe, it, expect } from 'vitest'
import { STRINGS, LANGS, TIMELINE_VALUES, isLang, type Lang } from '@/lib/register-i18n'

const CODES = Object.keys(STRINGS) as Lang[]

describe('register form translations', () => {
  it('covers exactly the languages offered in the picker', () => {
    expect(new Set(CODES)).toEqual(new Set(LANGS.map((l) => l.code)))
  })

  it('isLang accepts every picker code and rejects junk', () => {
    for (const { code } of LANGS) expect(isLang(code)).toBe(true)
    expect(isLang('xx')).toBe(false)
    expect(isLang('')).toBe(false)
    expect(isLang(undefined)).toBe(false)
    expect(isLang(42)).toBe(false)
    // Object prototype members must not read as languages.
    expect(isLang('toString')).toBe(false)
    expect(isLang('constructor')).toBe(false)
  })

  it('has no empty strings (englishGoverns exempt for English only)', () => {
    for (const code of CODES) {
      const t = STRINGS[code] as unknown as Record<string, string | string[]>
      for (const [key, value] of Object.entries(t)) {
        if (code === 'en' && key === 'englishGoverns') continue
        if (Array.isArray(value)) {
          value.forEach((v) => expect(v, `${code}.${key}`).toBeTruthy())
        } else {
          expect(value, `${code}.${key}`).toBeTruthy()
        }
      }
    }
  })

  it('keeps four timeline labels matching the four submitted values', () => {
    expect(TIMELINE_VALUES).toHaveLength(4)
    for (const code of CODES) {
      expect(STRINGS[code].timelines, code).toHaveLength(4)
    }
  })

  it('keeps the {button} placeholder and literal STOP/HELP keywords in every consent text', () => {
    for (const code of CODES) {
      const consent = STRINGS[code].consentSms
      expect(consent, code).toContain('{button}')
      // Twilio only recognizes the English keywords — translations must not
      // localize them.
      expect(consent, code).toContain('STOP')
      expect(consent, code).toContain('HELP')
    }
  })

  it('keeps the {button} placeholder in every WhatsApp consent and names WhatsApp in the channel copy', () => {
    for (const code of CODES) {
      const t = STRINGS[code]
      expect(t.consentWhatsApp, code).toContain('{button}')
      expect(t.consentWhatsApp, code).toContain('WhatsApp')
      expect(t.sentBody1WhatsApp, code).toContain('WhatsApp')
      expect(t.checkWhatsApp, code).toContain('WhatsApp')
      // WhatsApp is not an SMS carrier channel — no STOP/HELP keyword promise.
      expect(t.consentWhatsApp, code).not.toContain('STOP')
    }
  })

  it('no longer limits phone numbers to the US/Canada in any language', () => {
    for (const code of CODES) {
      expect(STRINGS[code].errPhone, code).not.toMatch(/U\.S\.|US |Canad|EE\. UU|Hoa Kỳ|美国|美國|미국|अमेरिक|ਅਮਰੀਕ|Kanad|Канад|Καναδ|Canada/)
    }
  })

  it('adds an English-version-governs note to every non-English consent', () => {
    for (const code of CODES) {
      if (code === 'en') continue
      expect(STRINGS[code].englishGoverns, code).toBeTruthy()
    }
  })

  it('non-English languages actually differ from English', () => {
    for (const code of CODES) {
      if (code === 'en') continue
      expect(STRINGS[code].requestBtn, code).not.toBe(STRINGS.en.requestBtn)
      expect(STRINGS[code].consentSms, code).not.toBe(STRINGS.en.consentSms)
    }
  })
})
