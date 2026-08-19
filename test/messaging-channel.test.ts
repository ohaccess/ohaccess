import { describe, it, expect } from 'vitest'
import {
  DEFAULT_WHATSAPP_FIRST_COUNTRIES,
  whatsAppFirstCountries,
  whatsAppConfigured,
  preferredCodewordChannel,
  isWhatsAppFallbackError,
  whatsAppAddress,
} from '@/lib/messaging-channel'

const OFF: Record<string, string | undefined> = {}
const ON: Record<string, string | undefined> = {
  TWILIO_WHATSAPP_FROM: 'whatsapp:+18889213995',
  TWILIO_WHATSAPP_CODEWORD_CONTENT_SID: 'HX0123456789abcdef0123456789abcdef',
}

describe('whatsAppConfigured', () => {
  it('needs both the sender and the template', () => {
    expect(whatsAppConfigured(OFF)).toBe(false)
    expect(whatsAppConfigured({ TWILIO_WHATSAPP_FROM: 'whatsapp:+1' })).toBe(false)
    expect(whatsAppConfigured({ TWILIO_WHATSAPP_CODEWORD_CONTENT_SID: 'HX1' })).toBe(false)
    expect(whatsAppConfigured(ON)).toBe(true)
  })
})

describe('whatsAppFirstCountries', () => {
  it('defaults to the curated list', () => {
    const set = whatsAppFirstCountries(OFF)
    expect(set.has('IN')).toBe(true)
    expect(set.has('US')).toBe(false)
    expect(set.size).toBe(DEFAULT_WHATSAPP_FIRST_COUNTRIES.length)
  })
  it('can be replaced wholesale from the environment, ignoring junk', () => {
    const set = whatsAppFirstCountries({ WHATSAPP_FIRST_COUNTRIES: 'in, br ,xx,,AU' })
    expect([...set].sort()).toEqual(['AU', 'BR', 'IN'])
  })
  it('an all-junk override falls back to the default list', () => {
    expect(whatsAppFirstCountries({ WHATSAPP_FIRST_COUNTRIES: 'nope,??' }).has('IN')).toBe(true)
  })
})

describe('preferredCodewordChannel', () => {
  it('is SMS for everyone when WhatsApp is not configured', () => {
    expect(preferredCodewordChannel('IN', false, ON)).toBe('sms')
    expect(preferredCodewordChannel('IN', whatsAppConfigured(OFF), OFF)).toBe('sms')
  })
  it('is WhatsApp-first only for the listed countries when configured', () => {
    expect(preferredCodewordChannel('IN', true, ON)).toBe('whatsapp')
    expect(preferredCodewordChannel('br', true, ON)).toBe('whatsapp')
    expect(preferredCodewordChannel('US', true, ON)).toBe('sms')
    expect(preferredCodewordChannel('CA', true, ON)).toBe('sms')
    expect(preferredCodewordChannel('AU', true, ON)).toBe('sms')
    expect(preferredCodewordChannel(null, true, ON)).toBe('sms')
    expect(preferredCodewordChannel('ZZ', true, ON)).toBe('sms')
  })
  it('honours the environment override', () => {
    const env = { ...ON, WHATSAPP_FIRST_COUNTRIES: 'AU' }
    expect(preferredCodewordChannel('AU', true, env)).toBe('whatsapp')
    expect(preferredCodewordChannel('IN', true, env)).toBe('sms')
  })
})

describe('isWhatsAppFallbackError', () => {
  it('recognises the routing errors and nothing else', () => {
    expect(isWhatsAppFallbackError({ code: 21408 })).toBe(true)
    expect(isWhatsAppFallbackError({ code: 21612 })).toBe(true)
    expect(isWhatsAppFallbackError({ code: 21614 })).toBe(true)
    expect(isWhatsAppFallbackError({ code: 21211 })).toBe(false) // invalid number
    expect(isWhatsAppFallbackError({ code: 21610 })).toBe(false) // opted out
    expect(isWhatsAppFallbackError({ code: '21408' })).toBe(false)
    expect(isWhatsAppFallbackError(new Error('boom'))).toBe(false)
    expect(isWhatsAppFallbackError(null)).toBe(false)
  })
})

describe('whatsAppAddress', () => {
  it('prefixes E.164 once', () => {
    expect(whatsAppAddress('+61412345678')).toBe('whatsapp:+61412345678')
    expect(whatsAppAddress('whatsapp:+61412345678')).toBe('whatsapp:+61412345678')
  })
})
