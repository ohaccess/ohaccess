// Agent verification: the one-time check an agent passes before publishing
// their first open house (Dave, 2026-09-13 — keep non-agents from using
// ohACCESS to collect strangers' phone numbers).
//
// Two parts, done together on the New Open House screen:
//   • a 6-digit code texted to their mobile (WhatsApp in countries where our
//     SMS can't reach) — proves a real, reachable phone; internet/app numbers
//     (Google Voice, TextNow) and landlines are refused up front
//   • their licence number, but ONLY where their country licenses agents and
//     the number isn't optional (lib/regions.ts) — the UK and friends skip it
//
// Enforcement is in the database (migration 051): open_houses inserts are
// refused until profiles.agent_verified_at is set, and agents can't set that
// column themselves. Agents who already had an open house (or were on a team)
// when 051 ran were grandfathered in.
//
// Pure and browser-safe: the client card and the API route share these rules.
// Code generation/hashing (node:crypto) lives in lib/agent-verification-codes.

import { regionFor, type SubRegion } from '@/lib/regions'
import { isVirtualNumber } from '@/lib/register-helpers'

export const VERIFY_CODE_LENGTH = 6
export const VERIFY_CODE_TTL_MINUTES = 10
// Wrong guesses allowed per code before a new one has to be sent.
export const VERIFY_MAX_ATTEMPTS = 5
// Codes an agent can request per hour (each one costs a text).
export const VERIFY_SENDS_PER_HOUR = 5
// Seconds the "Send a new code" link stays disabled after a send.
export const VERIFY_RESEND_COOLDOWN_SECONDS = 30

// Does this profile still have to verify? False while the dashboard's profile
// predates migration 051 (column absent), so shipping the code before the
// migration runs changes nothing.
export function needsAgentVerification(profile: Record<string, unknown> | null | undefined): boolean {
  if (!profile) return false
  if (!Object.prototype.hasOwnProperty.call(profile, 'agent_verified_at')) return false
  return !profile.agent_verified_at
}

export type LicenceRequirement = {
  numberLabel: string
  numberPlaceholder: string
  // The issuing state/province, when the country licenses per jurisdiction.
  regionLabel: string | null
  regions: SubRegion[] | null
}

// The licence fields verification asks for in `country`, or null when that
// country doesn't license agents or the number is optional there.
export function licenceRequirement(country: string | null | undefined): LicenceRequirement | null {
  const licence = regionFor(country).licence
  if (!licence || licence.optional) return null
  return {
    numberLabel: licence.numberLabel,
    numberPlaceholder: licence.numberPlaceholder,
    regionLabel: licence.regionLabel,
    regions: licence.regions,
  }
}

// Agent-facing reason the licence part is incomplete, or null when it's fine.
export function licenceError(
  country: string | null | undefined,
  licenceNumber: string | null | undefined,
  licenceRegion: string | null | undefined
): string | null {
  const req = licenceRequirement(country)
  if (!req) return null
  const number = (licenceNumber || '').trim()
  if (number.length < 3) return `Please enter your ${req.numberLabel.toLowerCase()}.`
  if (number.length > 40) return `That ${req.numberLabel.toLowerCase()} looks too long.`
  if (req.regionLabel && req.regions) {
    const code = (licenceRegion || '').trim().toUpperCase()
    if (!req.regions.some(r => r.code === code)) return `Please choose the ${req.regionLabel.toLowerCase()} that issued your licence.`
  }
  return null
}

// Twilio Lookup line type → why the number can't be used, or null. Unknown
// (lookup failed or returned nothing) is allowed: a slow lookup must never
// lock a real agent out, and the texted code still has to arrive.
export function lineTypeProblem(lineType: string | null | undefined): string | null {
  if (isVirtualNumber(lineType)) {
    return 'Internet and app-based numbers (like Google Voice or TextNow) can’t be used. Please enter your mobile number.'
  }
  const t = (lineType || '').toLowerCase()
  if (t === 'landline' || t === 'tollfree' || t === 'pager' || t === 'voicemail') {
    return 'That doesn’t look like a mobile number, so it can’t receive a text. Please enter your mobile number.'
  }
  return null
}

// Plain ASCII, one segment.
export function verificationSmsBody(code: string): string {
  return `ohACCESS: Your verification code is ${code}. It expires in ${VERIFY_CODE_TTL_MINUTES} minutes. If you didn't request this, ignore this text.`
}
