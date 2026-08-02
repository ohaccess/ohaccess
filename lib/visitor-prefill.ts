// Returning-visitor prefill (the "welcome back" cookie). After a successful
// sign-in, /api/register stores the visitor's contact details in a cookie on
// their own device; the /register/[id] server page reads it back and hands
// the values to the form, so at their NEXT ohACCESS open house — any agent's —
// the form is already filled in.
//
// Design notes:
// - Server-SET on the register response (not written by page JS) because
//   Safari's ITP purges script-written storage after ~7 days of not visiting;
//   a server-set first-party cookie survives the full year.
// - NOT httpOnly: the "Not you?" link clears it client-side with
//   document.cookie. The value is the visitor's own contact info on their own
//   device, so script readability adds no exposure beyond the form itself.
// - Scoped to Path=/register so it rides along only on sign-in pages.
// - The value is display convenience only — nothing trusts it server-side.

export const VISITOR_COOKIE = 'ohaccess_visitor'
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year
export const VISITOR_COOKIE_PATH = '/register'

export type VisitorPrefill = {
  firstName: string
  lastName: string
  email: string
  phone: string
}

// Caps keep the cookie tiny and shrug off junk. Generous for real data.
const MAX_FIELD = 80

function cleanField(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_FIELD) return null
  return trimmed
}

export function serializeVisitorPrefill(v: VisitorPrefill): string | null {
  const firstName = cleanField(v.firstName)
  const lastName = cleanField(v.lastName)
  const email = cleanField(v.email)
  const phone = cleanField(v.phone)
  if (!firstName || !lastName || !email || !phone) return null
  return encodeURIComponent(JSON.stringify({ firstName, lastName, email, phone }))
}

// Tolerates anything: a tampered or truncated cookie just means no prefill.
export function parseVisitorPrefill(raw: string | undefined | null): VisitorPrefill | null {
  if (!raw || raw.length > 2000) return null
  try {
    const data = JSON.parse(decodeURIComponent(raw))
    const firstName = cleanField(data?.firstName)
    const lastName = cleanField(data?.lastName)
    const email = cleanField(data?.email)
    const phone = cleanField(data?.phone)
    if (!firstName || !lastName || !email || !phone) return null
    return { firstName, lastName, email, phone }
  } catch {
    return null
  }
}
