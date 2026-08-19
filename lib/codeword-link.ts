import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'crypto'

// The "check-in details" link that rides in the WhatsApp codeword message.
//
// Meta will not approve a Utility template that hands the visitor a secret
// word in the message body — three wordings were rejected as "authentication
// content" (2026-08-19), and the Authentication category it wants instead is
// locked behind business verification. What Meta does approve is a plain
// check-in confirmation with a link. So the WhatsApp message says "tap to
// view your check-in details" and THIS link opens a page showing the
// codeword(s).
//
// The security property is unchanged: the codeword still only ever reaches
// the visitor through a channel they proved they control. The link is
// delivered to the WhatsApp number and nowhere else — never in the
// /api/register response (which deliberately never carries the codeword), so
// a sign-in with a made-up phone number can't read it. The link itself is the
// visitor id plus an HMAC over it under a server-only key, so it can't be
// forged from the id alone, and it's wrapped in a random ohaccess.com/r/
// short code so the message stays short.
//
// Key: CODEWORD_LINK_SECRET if set, otherwise derived from the service-role
// key (already server-only and present in every environment) — no new env
// var needed to ship.

const PATH_PREFIX = '/checkin'

function key(): Buffer {
  const seed = process.env.CODEWORD_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createHash('sha256').update('ohaccess-codeword-link:' + seed).digest()
}

export function codewordLinkSignature(visitorId: string): string {
  return createHmac('sha256', key()).update(visitorId).digest('hex').slice(0, 32)
}

// Path (no host) of the check-in details page for a visitor.
export function codewordLinkPath(visitorId: string): string {
  return `${PATH_PREFIX}/${encodeURIComponent(visitorId)}/${codewordLinkSignature(visitorId)}`
}

export function verifyCodewordLink(visitorId: string, sig: string): boolean {
  if (!/^[0-9a-f]{32}$/i.test(sig || '')) return false
  const expected = Buffer.from(codewordLinkSignature(visitorId), 'utf8')
  const given = Buffer.from(sig.toLowerCase(), 'utf8')
  return expected.length === given.length && timingSafeEqual(expected, given)
}
