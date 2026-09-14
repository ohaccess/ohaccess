// Visitors the agent types into the dashboard by hand, for people who
// couldn't sign in with the QR code (no signal, no phone, didn't want to).
// Pure, so the API route and the tests share one set of rules.
//
// A hand-entered visitor is stored with visitors.source = 'manual'. Nothing
// about them was checked with a codeword, and they never saw or accepted the
// sign-in consent, so ohACCESS never messages them: no codeword, no thank-you
// email, no invites (those senders filter on source), no sponsor attribution.
// They do count toward the free-trial cap, same as any other visitor.

import { TIMELINE_VALUES } from '@/lib/register-i18n'
import { isEmail } from '@/lib/register-helpers'
import { phoneError, storablePhone } from '@/lib/phone'
import { normalizeCountry } from '@/lib/regions'

export const MANUAL_VISITOR_SOURCE = 'manual'

export const isManualVisitor = (v: { source?: string | null } | null | undefined): boolean =>
  v?.source === MANUAL_VISITOR_SOURCE

export const MANUAL_NAME_MAX = 60
export const MANUAL_NOTES_MAX = 2000

export type ManualVisitorFields = {
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  purchasing_timeline: string | null
  notes: string | null
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

// Checks the form body. The agent is standing at the door, so only a first
// name and one way to reach the visitor (mobile or email) are required.
// `defaultCountry` reads a phone typed without a country chip.
export function validateManualVisitor(
  body: Record<string, unknown> | null | undefined,
  defaultCountry: string
): { ok: true; fields: ManualVisitorFields } | { ok: false; error: string } {
  const b = body ?? {}
  const firstName = str(b.firstName)
  const lastName = str(b.lastName)
  if (!firstName) return { ok: false, error: 'Please enter the visitor’s first name.' }
  if (firstName.length > MANUAL_NAME_MAX || lastName.length > MANUAL_NAME_MAX) {
    return { ok: false, error: `Names can be at most ${MANUAL_NAME_MAX} characters.` }
  }

  const rawEmail = str(b.email)
  const rawPhone = str(b.phone)
  if (!rawEmail && !rawPhone) {
    return { ok: false, error: 'Please enter a mobile number or an email so you can follow up.' }
  }

  let email: string | null = null
  if (rawEmail) {
    if (!isEmail(rawEmail)) return { ok: false, error: 'That email address doesn’t look right.' }
    email = rawEmail.toLowerCase()
  }

  let phone: string | null = null
  if (rawPhone) {
    const country = normalizeCountry(str(b.phoneCountry)) ?? defaultCountry
    const stored = storablePhone(rawPhone, country)
    const problem = stored ? phoneError(stored, country) : 'Please enter a valid phone number.'
    if (problem) return { ok: false, error: problem }
    phone = stored
  }

  const timeline = str(b.timeline)
  if (timeline && !(TIMELINE_VALUES as readonly string[]).includes(timeline)) {
    return { ok: false, error: 'Please pick a buying timeline from the list.' }
  }

  const notes = str(b.notes)
  if (notes.length > MANUAL_NOTES_MAX) {
    return { ok: false, error: `Notes can be at most ${MANUAL_NOTES_MAX} characters.` }
  }

  return {
    ok: true,
    fields: {
      first_name: firstName,
      last_name: lastName || null,
      email,
      phone,
      purchasing_timeline: timeline || null,
      notes: notes || null,
    },
  }
}
