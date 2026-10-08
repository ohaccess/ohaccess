// First-touch marketing attribution, shared by the browser (RefCapture, the
// signup form, the dashboard's profile auto-create) and the server routes
// that create profile rows (notify/new-account, gift/claim).
//
// Two cookies, each first-touch (an existing value is never overwritten, so
// the source that first brought the agent in keeps the credit):
//   ohaccess_ref  →  ?ref=<code>           (referral links, printed codes, ads)
//   ohaccess_utm  →  utm_* + landing page  (posts, ads, outreach links)
// Both ride into auth user_metadata at signup, which survives the email
// confirmation hop even when the confirm link opens in another browser, and
// land on the profiles row (migration 059 columns) from there.

export const REF_COOKIE = 'ohaccess_ref'
export const UTM_COOKIE = 'ohaccess_utm'
export const ATTRIBUTION_COOKIE_MAX_AGE_DAYS = 30

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
export type UtmKey = (typeof UTM_KEYS)[number]

export type Attribution = Partial<Record<UtmKey, string>> & { landing_page?: string }

const MAX_VALUE_LENGTH = 120
const MAX_PATH_LENGTH = 200

// utm values are free text chosen by whoever built the link ("fb-reel-3",
// "Open House Safety"), so keep printable characters only and cap the length:
// nothing here is ever interpreted, only stored and shown in admin.
export function cleanAttributionValue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.replace(/[\u0000-\u001f\u007f<>"'`\\]/g, '').trim().slice(0, MAX_VALUE_LENGTH)
  return v.length > 0 ? v : null
}

function cleanPath(pathname: unknown): string | null {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return null
  const v = pathname.replace(/[^A-Za-z0-9/._~-]/g, '').slice(0, MAX_PATH_LENGTH)
  return v.length > 0 ? v : null
}

// The utm_* fields present in a URL's query string, plus the page they landed
// on. null when the URL carries no utm_* at all (a landing page alone is not
// attribution worth storing).
export function attributionFromUrl(search: string, pathname: string): Attribution | null {
  const params = new URLSearchParams(search)
  const out: Attribution = {}
  let any = false
  for (const key of UTM_KEYS) {
    const v = cleanAttributionValue(params.get(key))
    if (v) { out[key] = v; any = true }
  }
  if (!any) return null
  const landing = cleanPath(pathname)
  if (landing) out.landing_page = landing
  return out
}

// Works on document.cookie in the browser and on a Cookie request header on
// the server (same "a=b; c=d" shape).
export function readCookie(cookieString: string | null | undefined, name: string): string | null {
  if (!cookieString) return null
  const hit = cookieString.split('; ').find((c) => c.startsWith(`${name}=`))
  if (!hit) return null
  try {
    const v = decodeURIComponent(hit.slice(name.length + 1))
    return v.length > 0 ? v : null
  } catch {
    return null
  }
}

export function encodeUtmCookieValue(a: Attribution): string {
  return encodeURIComponent(JSON.stringify(a))
}

// Re-validates every field on the way back out of the cookie: a cookie is
// client-controlled and must not be trusted just because we wrote it once.
export function parseUtmCookie(cookieString: string | null | undefined): Attribution | null {
  const raw = readCookie(cookieString, UTM_COOKIE)
  if (!raw) return null
  try {
    return sanitizeAttribution(JSON.parse(raw))
  } catch {
    return null
  }
}

// Picks the attribution fields out of any loosely typed bag (a parsed cookie,
// auth user_metadata) and cleans them. null when nothing usable is there.
export function sanitizeAttribution(bag: unknown): Attribution | null {
  if (!bag || typeof bag !== 'object') return null
  const rec = bag as Record<string, unknown>
  const out: Attribution = {}
  let any = false
  for (const key of UTM_KEYS) {
    const v = cleanAttributionValue(rec[key])
    if (v) { out[key] = v; any = true }
  }
  if (!any) return null
  const landing = cleanPath(rec.landing_page)
  if (landing) out.landing_page = landing
  return out
}

// The profiles columns for an attribution (migration 059). Spread into the
// insert row; an empty object when there is nothing to record.
export function attributionProfileFields(a: Attribution | null): Record<string, string> {
  if (!a) return {}
  const fields: Record<string, string> = {}
  for (const key of UTM_KEYS) if (a[key]) fields[key] = a[key]!
  if (a.landing_page) fields.landing_page = a.landing_page
  return fields
}

// One line for admin screens: "facebook / paid / oct-safety-reel".
export function attributionLabel(a: Attribution | null | undefined): string {
  if (!a) return ''
  return [a.utm_source, a.utm_medium, a.utm_campaign].filter(Boolean).join(' / ')
}
