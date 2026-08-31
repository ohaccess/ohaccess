// Meta Pixel + Google tag (Google Ads / GA4) for paid acquisition.
//
// Where the tags run is the whole point of this module. They load ONLY on the
// public marketing surface (see isMarketingPath) and never on:
//   - visitor-facing pages (/register, /r, /report, /unsubscribe, the legal
//     pages a visitor reaches from the sign-in form) — Privacy Policy §10
//     promises no advertising pixels there;
//   - the agent dashboard, admin, and sponsor portal, which display third-party
//     (visitor) PII that auto-collecting tags could scrape.
// The one exception is the post-checkout purchase conversion on /dashboard,
// where trackPurchase() lazily loads Meta + Google Ads (never GA4, whose
// enhanced measurement records outbound mailto:/tel: link clicks).
//
// Everything is env-driven and inert when the IDs are unset. Browsers sending
// the Global Privacy Control signal get no ad tags at all.
//
// Scripts are injected by hand rather than through next/script because the
// same loader has to run declaratively (MarketingTags on marketing routes)
// and imperatively (trackPurchase on the dashboard).

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || ''
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || ''
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''

// Google Ads conversion labels — the part after the slash in "AW-123/AbCdEf".
// Each comes from a conversion action created in the Google Ads UI; when a
// label is unset that Ads conversion is simply not sent (the GA4 event still is).
const GOOGLE_ADS_SIGNUP_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL || ''
const GOOGLE_ADS_PURCHASE_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL || ''
const GOOGLE_ADS_LEAD_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL || ''

const MARKETING_PATHS = new Set([
  '/',
  '/new',
  '/old',
  '/blog',
  '/faq',
  '/contact',
  '/partners',
  '/resources',
  '/login',
  '/gift',
])
const MARKETING_PREFIXES = ['/blog/']

export function isMarketingPath(pathname: string): boolean {
  if (MARKETING_PATHS.has(pathname)) return true
  return MARKETING_PREFIXES.some((p) => pathname.startsWith(p))
}

export function hasMarketingTags(): boolean {
  return !!(META_PIXEL_ID || GOOGLE_ADS_ID || GA_MEASUREMENT_ID)
}

type QueueFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: IArguments[]
  push: unknown
  loaded: boolean
  version: string
}

declare global {
  interface Window {
    fbq?: QueueFn
    _fbq?: QueueFn
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
  interface Navigator {
    globalPrivacyControl?: boolean
  }
}

function gpcOptOut(): boolean {
  return typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true
}

function injectScript(src: string) {
  const s = document.createElement('script')
  s.async = true
  s.src = src
  document.head.appendChild(s)
}

// Same stub Meta's official snippet defines: calls made before fbevents.js
// arrives are queued and replayed by the library once it loads.
function loadMetaPixel() {
  if (window.fbq) return
  const fbq = function () {
    // eslint-disable-next-line prefer-rest-params
    const args = arguments
    if (fbq.callMethod) fbq.callMethod(...Array.from(args))
    else fbq.queue.push(args)
  } as QueueFn
  fbq.queue = []
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = '2.0'
  window.fbq = fbq
  window._fbq = fbq
  injectScript('https://connect.facebook.net/en_US/fbevents.js')
  // No automatic collection of button clicks / page microdata — the pixel
  // sends only what this module explicitly tracks.
  fbq('set', 'autoConfig', false, META_PIXEL_ID)
  fbq('init', META_PIXEL_ID)
  fbq('track', 'PageView')
}

function loadGoogleTag(ids: string[]) {
  if (ids.length === 0) return
  window.dataLayer = window.dataLayer || []
  if (!window.gtag) {
    // gtag.js needs the raw `arguments` object on the dataLayer, not an array.
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments)
    }
    injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids[0])}`)
    window.gtag('js', new Date())
  }
  for (const id of ids) window.gtag('config', id)
}

let loaded = false

// Idempotent. Returns true only on the call that actually performed the load
// (which already sent the initial page view), so callers know whether to send
// a route-change page view themselves.
export function loadMarketingTags(): boolean {
  if (typeof window === 'undefined' || loaded) return false
  if (!hasMarketingTags() || gpcOptOut()) return false
  loaded = true

  if (META_PIXEL_ID) loadMetaPixel()

  const googleIds: string[] = []
  if (GOOGLE_ADS_ID) googleIds.push(GOOGLE_ADS_ID)
  // GA4 only where the page can't expose visitor PII (see header comment).
  if (GA_MEASUREMENT_ID && isMarketingPath(window.location.pathname)) googleIds.push(GA_MEASUREMENT_ID)
  loadGoogleTag(googleIds)
  return true
}

// Client-side route change on the marketing surface. GA4's enhanced
// measurement records history changes on its own, so only the Ads tag gets an
// explicit page_view here (send_to keeps it out of GA4 — no double count).
export function trackPageView() {
  window.fbq?.('track', 'PageView')
  if (GOOGLE_ADS_ID) window.gtag?.('event', 'page_view', { send_to: GOOGLE_ADS_ID })
}

function googleAdsConversion(label: string, params: Record<string, unknown> = {}) {
  if (!GOOGLE_ADS_ID || !label) return
  window.gtag?.('event', 'conversion', { send_to: `${GOOGLE_ADS_ID}/${label}`, ...params })
}

// Meta requires currency to be a bare ISO 4217 code and value to be numeric —
// an empty string or missing pair gets the event flagged as low data quality.
// value 0 clears the warning without inventing a lead value; if value-based
// optimization is ever wanted, change it HERE ONLY (the CAPI relay imports
// this same object, keeping both legs byte-identical for Meta's comparison).
export const META_SIGNUP_CUSTOM_DATA = {
  content_name: 'agent_trial_signup',
  status: 'complete',
  currency: 'USD',
  value: 0,
} as const

// Account created (signup form submitted; email confirmation still pending).
// Fired here rather than on the confirmation click because that click often
// happens on another device, where the ad-click attribution cookie isn't.
//
// Meta gets the event twice — browser pixel + Conversions API relay
// (app/api/meta-event) — sharing one eventID so Meta deduplicates. The server
// copy survives iOS tracking prevention and ad blockers, which drop 20–40% of
// browser pixel events. userId (the Supabase auth user id) becomes Meta's
// external_id on both legs: fbevents.js SHA-256-hashes advanced-matching
// fields in the browser, and the relay hashes the same raw value server-side,
// so the two digests match.
export function trackSignup(email?: string, userId?: string) {
  loadMarketingTags()
  const eventId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`
  // Re-init with advanced matching now that we know who signed up. fbevents.js
  // treats a repeat init for the same pixel id as a userData update (it logs a
  // console warning, which is expected) and attaches em/external_id to this
  // and every later event.
  if (window.fbq && (email || userId)) {
    window.fbq('init', META_PIXEL_ID, {
      ...(email ? { em: email.trim().toLowerCase() } : {}),
      ...(userId ? { external_id: userId } : {}),
    })
  }
  window.fbq?.('track', 'CompleteRegistration', { ...META_SIGNUP_CUSTOM_DATA }, { eventID: eventId })
  window.gtag?.('event', 'sign_up', { method: 'email' })
  googleAdsConversion(GOOGLE_ADS_SIGNUP_LABEL)
  // Fire-and-forget: tracking must never delay or break the signup flow.
  // keepalive lets the request finish even if the page navigates away.
  if (META_PIXEL_ID && !gpcOptOut()) {
    fetch('/api/meta-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        eventName: 'CompleteRegistration',
        eventId,
        email,
        userId,
        sourceUrl: window.location.href,
      }),
    }).catch(() => {})
  }
}

// Contact / partner inquiry form submitted.
export function trackLead() {
  loadMarketingTags()
  window.fbq?.('track', 'Lead')
  window.gtag?.('event', 'generate_lead')
  googleAdsConversion(GOOGLE_ADS_LEAD_LABEL)
}

// Paid subscription started. value is in whole currency units (dollars), and
// transactionId (the Stripe Checkout Session id) lets both platforms de-dupe.
export function trackPurchase(p: { value: number; currency: string; transactionId: string; plan?: string }) {
  loadMarketingTags()
  const currency = p.currency.toUpperCase()
  window.fbq?.('track', 'Purchase', {
    value: p.value,
    currency,
    content_name: p.plan,
    content_type: 'product',
  })
  window.gtag?.('event', 'purchase', {
    transaction_id: p.transactionId,
    value: p.value,
    currency,
    items: p.plan ? [{ item_name: p.plan, price: p.value, quantity: 1 }] : undefined,
  })
  googleAdsConversion(GOOGLE_ADS_PURCHASE_LABEL, {
    value: p.value,
    currency,
    transaction_id: p.transactionId,
  })
}
