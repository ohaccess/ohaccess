import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isMarketingPath } from '@/lib/marketing-tags'

// The allowlist is the privacy guarantee: Privacy Policy §10 promises no ad
// pixels on visitor-facing pages, and the dashboard/admin/sponsor surfaces
// display visitor PII. Anything not explicitly marketing must be excluded.
describe('isMarketingPath', () => {
  it('allows the public marketing surface', () => {
    for (const p of ['/', '/new', '/old', '/blog', '/blog/why-verify', '/faq', '/contact', '/partners', '/resources', '/login', '/gift']) {
      expect(isMarketingPath(p), p).toBe(true)
    }
  })

  it('excludes visitor-facing pages', () => {
    for (const p of ['/register/abc123', '/r/XYZ', '/report/abc', '/unsubscribe', '/verification/opt-in-proof', '/terms', '/privacy', '/subscriber-terms']) {
      expect(isMarketingPath(p), p).toBe(false)
    }
  })

  it('excludes logged-in surfaces that show visitor data', () => {
    for (const p of ['/dashboard', '/admin', '/sponsor', '/sponsor/dashboard', '/visitor/abc', '/map/secret', '/accept-invite', '/sponsor-invite']) {
      expect(isMarketingPath(p), p).toBe(false)
    }
  })

  it('does not treat lookalike prefixes as marketing', () => {
    expect(isMarketingPath('/blogger')).toBe(false)
    expect(isMarketingPath('/loginx')).toBe(false)
    expect(isMarketingPath('/newsletter')).toBe(false)
  })
})

// Loader + event helpers, driven through a minimal fake browser. Both Meta and
// Google queue calls made before their libraries arrive, so the queues are
// exactly what the platforms would receive.
describe('loadMarketingTags / track*', () => {
  const g = globalThis as Record<string, unknown>
  let injected: string[]

  type Win = { location: { pathname: string }; fbq?: { queue: IArguments[] }; dataLayer?: IArguments[] }
  const win = () => g.window as Win
  const fbqCalls = () => (win().fbq?.queue ?? []).map((a) => Array.from(a))
  const gtagCalls = () => (win().dataLayer ?? []).map((a) => Array.from(a))

  async function load(pathname: string, opts: { gpc?: boolean; env?: Record<string, string> } = {}) {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '123456789012345')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-111')
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-222')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL', 'SIGN')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL', 'BUY')
    for (const [k, v] of Object.entries(opts.env ?? {})) vi.stubEnv(k, v)
    injected = []
    g.window = { location: { pathname } }
    g.document = {
      head: { appendChild: (s: { src: string }) => injected.push(s.src) },
      createElement: () => ({}),
    }
    vi.stubGlobal('navigator', opts.gpc ? { globalPrivacyControl: true } : {})
    return await import('@/lib/marketing-tags')
  }

  beforeEach(() => { injected = [] })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    delete g.window
    delete g.document
  })

  it('loads Meta + Ads + GA4 on a marketing route and sends the first page view', async () => {
    const m = await load('/')
    expect(m.loadMarketingTags()).toBe(true)
    expect(injected).toEqual([
      'https://connect.facebook.net/en_US/fbevents.js',
      'https://www.googletagmanager.com/gtag/js?id=AW-111',
    ])
    expect(fbqCalls()).toEqual([
      ['set', 'autoConfig', false, '123456789012345'],
      ['init', '123456789012345'],
      ['track', 'PageView'],
    ])
    const gt = gtagCalls()
    expect(gt[0][0]).toBe('js')
    expect(gt.slice(1)).toEqual([['config', 'AW-111'], ['config', 'G-222']])
    // Second call is a no-op and reports it did not load.
    expect(m.loadMarketingTags()).toBe(false)
  })

  it('never configures GA4 off the marketing surface (dashboard purchase path)', async () => {
    const m = await load('/dashboard')
    m.trackPurchase({ value: 199, currency: 'usd', transactionId: 'cs_test_abc', plan: 'pro_year' })
    expect(gtagCalls().filter((c) => c[0] === 'config')).toEqual([['config', 'AW-111']])
    expect(fbqCalls()).toContainEqual(['track', 'Purchase', { value: 199, currency: 'USD', content_name: 'pro_year', content_type: 'product' }])
    expect(gtagCalls()).toContainEqual(['event', 'purchase', {
      transaction_id: 'cs_test_abc', value: 199, currency: 'USD',
      items: [{ item_name: 'pro_year', price: 199, quantity: 1 }],
    }])
    expect(gtagCalls()).toContainEqual(['event', 'conversion', {
      send_to: 'AW-111/BUY', value: 199, currency: 'USD', transaction_id: 'cs_test_abc',
    }])
  })

  it('reports signup to every platform, with the Ads label when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const m = await load('/login')
    m.trackSignup('Agent@Example.com ', 'a1b2c3d4-0000-0000-0000-000000000001')
    // Advanced matching is set before the event: normalized email plus the
    // user id as external_id (fbevents.js hashes both before sending).
    expect(fbqCalls()).toContainEqual(['init', '123456789012345', {
      em: 'agent@example.com',
      external_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    }])
    // Browser pixel leg carries the required currency/value pair and an eventID…
    const reg = fbqCalls().find((c) => c[1] === 'CompleteRegistration')
    expect(reg?.[0]).toBe('track')
    expect(reg?.[2]).toEqual({ content_name: 'agent_trial_signup', status: 'complete', currency: 'USD', value: 0 })
    const eventId = (reg?.[3] as { eventID?: string } | undefined)?.eventID
    expect(eventId).toBeTruthy()
    // …and the Conversions API leg posts the SAME id, so Meta deduplicates.
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/meta-event')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      eventName: 'CompleteRegistration',
      eventId,
      email: 'Agent@Example.com ',
      userId: 'a1b2c3d4-0000-0000-0000-000000000001',
    })
    expect(gtagCalls()).toContainEqual(['event', 'sign_up', { method: 'email' }])
    expect(gtagCalls()).toContainEqual(['event', 'conversion', { send_to: 'AW-111/SIGN' }])
  })

  it('OAuth signup (trackSignupOnce): server relay first, pixel only after a fresh send', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const m = await load('/dashboard')
    await m.trackSignupOnce('agent@example.com', 'a1b2c3d4-0000-0000-0000-000000000002')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({ eventName: 'CompleteRegistration', userId: 'a1b2c3d4-0000-0000-0000-000000000002' })
    // The browser leg reuses the id the server was given, so the pair dedups.
    const reg = fbqCalls().find((c) => c[1] === 'CompleteRegistration')
    expect(reg?.[2]).toEqual({ content_name: 'agent_trial_signup', status: 'complete', currency: 'USD', value: 0 })
    expect((reg?.[3] as { eventID?: string }).eventID).toBe(body.eventId)
    expect(gtagCalls()).toContainEqual(['event', 'sign_up', { method: 'google' }])
    expect(gtagCalls()).toContainEqual(['event', 'conversion', { send_to: 'AW-111/SIGN' }])
  })

  it('OAuth signup fires nothing when the ledger says this user was already counted', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, skipped: 'duplicate' }) })
    vi.stubGlobal('fetch', fetchMock)
    const m = await load('/dashboard')
    await m.trackSignupOnce('agent@example.com', 'a1b2c3d4-0000-0000-0000-000000000002')
    expect(fetchMock).toHaveBeenCalledOnce()
    // No pixel load, no browser event, no Google events — one conversion total.
    expect(win().fbq).toBeUndefined()
    expect(win().dataLayer).toBeUndefined()
  })

  it('skips the Ads conversion when its label is unset but still sends the GA4 event', async () => {
    const m = await load('/contact')
    m.trackLead()
    expect(fbqCalls()).toContainEqual(['track', 'Lead'])
    expect(gtagCalls()).toContainEqual(['event', 'generate_lead'])
    expect(gtagCalls().some((c) => c[0] === 'event' && c[1] === 'conversion')).toBe(false)
  })

  it('sends a route-change page view to Meta and the Ads tag only', async () => {
    const m = await load('/')
    m.loadMarketingTags()
    m.trackPageView()
    expect(fbqCalls().filter((c) => c[1] === 'PageView')).toHaveLength(2)
    expect(gtagCalls()).toContainEqual(['event', 'page_view', { send_to: 'AW-111' }])
  })

  it('loads nothing when the browser sends Global Privacy Control', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const m = await load('/', { gpc: true })
    expect(m.loadMarketingTags()).toBe(false)
    m.trackSignup('agent@example.com')
    expect(injected).toEqual([])
    expect(win().fbq).toBeUndefined()
    expect(win().dataLayer).toBeUndefined()
    // GPC also suppresses the server-side Conversions API leg.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads nothing when no IDs are configured', async () => {
    const m = await load('/', { env: { NEXT_PUBLIC_META_PIXEL_ID: '', NEXT_PUBLIC_GOOGLE_ADS_ID: '', NEXT_PUBLIC_GA_MEASUREMENT_ID: '' } })
    expect(m.hasMarketingTags()).toBe(false)
    expect(m.loadMarketingTags()).toBe(false)
    expect(injected).toEqual([])
  })
})
