import { describe, it, expect } from 'vitest'
import { STRINGS, LANGS, TIMELINE_VALUES, type Lang } from '@/lib/register-i18n'

const CODES = Object.keys(STRINGS) as Lang[]

describe('register form translations', () => {
  it('covers exactly the languages offered in the picker', () => {
    expect(new Set(CODES)).toEqual(new Set(LANGS.map((l) => l.code)))
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
