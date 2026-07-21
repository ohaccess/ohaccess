import { describe, it, expect } from 'vitest'
import { deviceLabel } from '@/lib/ua-label'

describe('deviceLabel', () => {
  it('labels an iPhone Safari UA', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
      )
    ).toBe('iPhone · Safari')
  })

  it('labels Chrome on iPhone (CriOS) as Chrome, not Safari', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1'
      )
    ).toBe('iPhone · Chrome')
  })

  it('labels Android Chrome and desktop Edge', () => {
    expect(
      deviceLabel('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36')
    ).toBe('Android · Chrome')
    expect(
      deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0')
    ).toBe('Windows · Edge')
  })

  it('flags bots and scripts', () => {
    expect(deviceLabel('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe('Bot')
    expect(deviceLabel('curl/8.6.0')).toBe('Bot')
  })

  it('handles missing or unrecognized strings', () => {
    expect(deviceLabel(null)).toBe('Unknown device')
    expect(deviceLabel('')).toBe('Unknown device')
    expect(deviceLabel('SomethingWeird/1.0')).toBe('Unknown device')
  })
})
