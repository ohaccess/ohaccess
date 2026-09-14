import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'crypto'

// Signed star links in the post-event report email: /rate/<open house id>/<sig>
// ?score=N. The signature is an HMAC over the open house id under a
// server-only key, so nobody can rate an open house from its id alone.
// Same construction as lib/codeword-link.ts, with its own key prefix so the
// two kinds of link can never be swapped.
//
// Key: REPORT_RATING_SECRET if set, otherwise derived from the service-role
// key (server-only, present everywhere), so no new env var is needed.

const APP_URL = 'https://www.ohaccess.com'

function key(): Buffer {
  const seed = process.env.REPORT_RATING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createHash('sha256').update('ohaccess-report-rating:' + seed).digest()
}

export function reportRatingSignature(openHouseId: string): string {
  return createHmac('sha256', key()).update(openHouseId).digest('hex').slice(0, 32)
}

export function reportRatingUrl(openHouseId: string, score: number): string {
  return `${APP_URL}/rate/${encodeURIComponent(openHouseId)}/${reportRatingSignature(openHouseId)}?score=${score}`
}

export function verifyReportRating(openHouseId: string, sig: string): boolean {
  if (!/^[0-9a-f]{32}$/i.test(sig || '')) return false
  const expected = Buffer.from(reportRatingSignature(openHouseId), 'utf8')
  const given = Buffer.from(sig.toLowerCase(), 'utf8')
  return expected.length === given.length && timingSafeEqual(expected, given)
}
