// Which channel carries the visitor's codeword: SMS or WhatsApp.
//
// SMS from our US toll-free number reaches most of the world once the
// destination country is enabled under Twilio → Messaging → Geo permissions.
// But a handful of countries don't accept SMS from foreign long codes at all
// (or require a locally registered sender we don't have): India, the Gulf
// states, Egypt, the Philippines, Indonesia, Vietnam … In those countries
// WhatsApp is the default way people message, so that's where the codeword
// goes — delivered through Twilio's WhatsApp API from the ohACCESS WhatsApp
// sender, using an approved message template (business-initiated WhatsApp
// messages must use one).
//
// Two decisions, both pure so the sign-in form and the server agree:
//   preferredCodewordChannel(country) — WhatsApp-first for the list below
//     (when WhatsApp is configured), SMS everywhere else.
//   isWhatsAppFallbackError(code)     — a synchronous Twilio rejection that
//     means "SMS can't get there from here", so the sender tries WhatsApp
//     before giving up (the email codeword always goes regardless).
//
// Configuration (all optional — with nothing set, behaviour is exactly the
// pre-2026-08-19 SMS-only product):
//   TWILIO_WHATSAPP_FROM                  the WhatsApp sender, "whatsapp:+1888…"
//   TWILIO_WHATSAPP_CODEWORD_CONTENT_SID  the approved template's Content SID
//                                         (HX…)
//   TWILIO_WHATSAPP_TEMPLATE_KIND         what that template's variables carry
//                                         (see whatsAppTemplateKind below):
//                                         link (default) | word | auth
//   WHATSAPP_FIRST_COUNTRIES              comma-separated ISO codes that
//                                         replace the default list below
// Setup steps for Dave are in docs/international-setup.md.

import { normalizeCountry } from '@/lib/regions'

export type CodewordChannel = 'sms' | 'whatsapp'

// Countries where SMS from a foreign (US) number is blocked, filtered, or
// needs local sender registration, and where WhatsApp is the everyday
// messaging app. Conservative on purpose: a country NOT on this list still
// gets WhatsApp automatically if its SMS bounces with a routing error (see
// isWhatsAppFallbackError), so being wrong here costs one failed SMS
// attempt, not a lost codeword.
export const DEFAULT_WHATSAPP_FIRST_COUNTRIES = [
  'IN', // India — DLT registration required for any sender
  'AE', // UAE — registered sender IDs only
  'SA', // Saudi Arabia
  'QA', // Qatar
  'KW', // Kuwait
  'OM', // Oman
  'BH', // Bahrain
  'JO', // Jordan
  'EG', // Egypt — registered sender IDs only
  'PH', // Philippines — sender registration
  'ID', // Indonesia — registered sender IDs, international SMS heavily filtered
  'VN', // Vietnam — brand-name registration required
  'PK', // Pakistan
  'BD', // Bangladesh
  'LK', // Sri Lanka
  'NG', // Nigeria — DND filtering of international routes
  'KE', // Kenya
  'GH', // Ghana
  'TR', // Turkey — registered senders only
  'BR', // Brazil — WhatsApp is the default messenger; SMS works but is ignored
  'AR', // Argentina
  'CO', // Colombia
] as const

// Env is typed loosely so tests can pass plain objects.
type Env = Record<string, string | undefined>

export function whatsAppFirstCountries(env: Env = process.env): Set<string> {
  const override = (env.WHATSAPP_FIRST_COUNTRIES || '')
    .split(',')
    .map(c => normalizeCountry(c))
    .filter((c): c is string => !!c)
  return new Set(override.length > 0 ? override : DEFAULT_WHATSAPP_FIRST_COUNTRIES)
}

// Both the sender and an approved template are needed before a single
// WhatsApp message can go out. Missing either → WhatsApp is simply off.
export function whatsAppConfigured(env: Env = process.env): boolean {
  return !!(env.TWILIO_WHATSAPP_FROM && env.TWILIO_WHATSAPP_CODEWORD_CONTENT_SID)
}

// The shape of the approved template, i.e. what goes in its variables:
//   link  — "{{1}}" = address, "{{2}}" = a check-in-details LINK that opens
//           the page showing the codeword (lib/codeword-link.ts). This is the
//           one Meta approves for an unverified business — three "here is
//           your word" wordings were rejected as authentication content.
//   word  — "{{1}}" = address, "{{2}}" = the codeword itself (the original
//           design; only approvable once Meta stops reading it as an OTP).
//   auth  — Meta's fixed Authentication format, "{{1}}" = the codeword
//           ("LOVELY is your verification code."); needs business
//           verification before Meta will even create it.
export type WhatsAppTemplateKind = 'link' | 'word' | 'auth'

export function whatsAppTemplateKind(env: Env = process.env): WhatsAppTemplateKind {
  const k = (env.TWILIO_WHATSAPP_TEMPLATE_KIND || '').trim().toLowerCase()
  return k === 'word' || k === 'auth' ? k : 'link'
}

// The channel to TRY FIRST for a number in `country` (ISO code, from the
// visitor's phone). `enabled` lets the client pass what the server told it
// about WhatsApp availability.
export function preferredCodewordChannel(
  country: string | null | undefined,
  enabled: boolean = whatsAppConfigured(),
  env: Env = process.env
): CodewordChannel {
  if (!enabled) return 'sms'
  const code = normalizeCountry(country)
  if (!code) return 'sms'
  return whatsAppFirstCountries(env).has(code) ? 'whatsapp' : 'sms'
}

// Twilio REST error codes on messages.create that mean the SMS route itself
// is the problem (not the number):
//   21408  permission to send SMS to this region not enabled (Geo permissions)
//   21612  the 'To' number is not reachable via this route
//   21614  'To' is not a valid mobile number — landline or unroutable
//   21635  'To' is not a mobile number (another spelling of the above)
//   30008  unknown destination handset / route error (surfaced synchronously
//          by some carriers)
// Anything else (invalid number 21211, opted out 21610, our own config
// errors) is NOT retried over WhatsApp.
const WHATSAPP_FALLBACK_CODES = new Set([21408, 21612, 21614, 21635, 30008])

export function isWhatsAppFallbackError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === 'number' && WHATSAPP_FALLBACK_CODES.has(code)
}

// Twilio addresses WhatsApp endpoints as "whatsapp:+E164".
export function whatsAppAddress(e164: string): string {
  return e164.startsWith('whatsapp:') ? e164 : `whatsapp:${e164}`
}
