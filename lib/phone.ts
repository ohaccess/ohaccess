// Phone-number helpers for every country, with the North American (NANP)
// behaviour the app was built on preserved byte-for-byte.
//
// Storage convention (visitors.phone, profiles.phone, sponsors.phone):
//   • US / Canada / other +1 numbers: the legacy display form "(512) 555-1234"
//     — every existing row holds that, the phone-intel cache matches on it,
//     and the sign-in form still submits it. Unchanged.
//   • Everything else: E.164 ("+61412345678"). One unambiguous spelling, and
//     exactly what Twilio wants on the wire.
// normalizePhone() turns either into E.164 for sending / opt-out matching;
// formatPhoneDisplay() turns either into something readable.
//
// Validation is structural only — it proves a number is well-formed for its
// country, NOT that it's assigned and reachable (only a carrier lookup or a
// real send does that), so the post-send "undelivered" flag still backstops
// real-but-dead numbers.

import {
  parsePhoneNumberFromString,
  AsYouType,
  type CountryCode,
} from 'libphonenumber-js/min'
import { isNanpCountry, normalizeCountry } from '@/lib/regions'

// Normalize a phone number to E.164 (+XXXXXXXXXXX) so a number stored in one
// format — "(500) 555-0001" from the registration form, "+15005550001" from a
// Twilio callback — matches the same key in the opt-out list.
//
// `defaultCountry` says how to read a number typed WITHOUT a "+" (national
// format). It defaults to US so every existing caller behaves exactly as
// before: 10 digits → +1, 11 digits starting with 1 → +1…, and anything longer
// that starts with "+" passes through as already-international. For a
// non-NANP default country the number is parsed against that country's plan
// ("0412 345 678" + 'AU' → "+61412345678"). Returns null if there aren't
// enough digits to be a usable number.
export function normalizePhone(
  input: string | null | undefined,
  defaultCountry: string | null | undefined = 'US'
): string | null {
  if (!input) return null
  const raw = input.trim()
  const digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+')) {
    // International as typed. Let the parser clean it up; if it can't make
    // sense of it (far too short etc.) fall back to the legacy pass-through
    // so nothing that used to normalize stops normalizing.
    const parsed = parsePhoneNumberFromString(raw)
    if (parsed && parsed.isValid()) return parsed.number
    return digits.length > 11 ? `+${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : null
  }
  const country = normalizeCountry(defaultCountry) ?? 'US'
  if (isNanpCountry(country)) {
    if (digits.length === 10) return `+1${digits}`
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
    return null
  }
  const parsed = parsePhoneNumberFromString(raw, country as CountryCode)
  return parsed && parsed.isValid() ? parsed.number : null
}

// Structural (North American Numbering Plan) check for a US/Canada number.
// Returns a short, visitor-facing reason string if the number is *impossible*
// — or null if it's structurally valid. This proves the number is well-formed,
// NOT that it's an assigned, reachable line (only a carrier lookup does that),
// so the post-send "undelivered" flag still backstops real-but-dead numbers.
//
// Rules enforced (all hard NANP constraints):
//   • exactly 10 digits (an optional leading "1" country code is allowed)
//   • area code and exchange can't start with 0 or 1
//   • neither may be an N11 service code (211, 311, … 911)
//   • the 555-0100–0199 range is reserved for fiction
//   • all-identical digits (e.g. 2222222222) aren't real
export function usPhoneError(input: string | null | undefined): string | null {
  const raw = (input || '').replace(/\D/g, '')
  const d = raw.length === 11 && raw.startsWith('1') ? raw.slice(1) : raw
  if (d.length < 10) return 'Please enter a 10-digit US or Canadian phone number.'
  if (d.length > 10) return 'That number has too many digits.'
  const area = d.slice(0, 3)
  const exch = d.slice(3, 6)
  const line = d.slice(6)
  if (area[0] === '0' || area[0] === '1') return 'That area code isn’t valid.'
  if (exch[0] === '0' || exch[0] === '1') return 'That phone number isn’t valid.'
  if (/^[2-9]11$/.test(area) || /^[2-9]11$/.test(exch)) return 'That phone number isn’t valid.'
  if (exch === '555' && line >= '0100' && line <= '0199') return 'Please enter a real phone number.'
  if (/^(\d)\1{9}$/.test(d)) return 'Please enter a real phone number.'
  return null
}

// Convenience boolean wrapper around usPhoneError.
export function isPossibleUsPhone(input: string | null | undefined): boolean {
  return usPhoneError(input) === null
}

// Country-aware structural check. `country` is the country the number is
// read in when it has no "+" (the agent's / open house's country). A number
// typed WITH a "+" is checked against its own country regardless.
//   • NANP numbers get the strict usPhoneError rules above (unchanged).
//   • Everything else: libphonenumber's length/pattern check for that plan.
// Returns a visitor-facing English reason, or null when it's fine.
export function phoneError(
  input: string | null | undefined,
  country: string | null | undefined = 'US'
): string | null {
  const raw = (input || '').trim()
  if (!raw) return 'Please enter your mobile number.'
  const fallback = normalizeCountry(country) ?? 'US'
  if (raw.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(raw)
    if (!parsed) return 'Please enter a valid mobile number, including the country code.'
    if (parsed.countryCallingCode === '1') return usPhoneError(parsed.nationalNumber)
    return parsed.isValid() ? null : 'That phone number isn’t valid for its country code.'
  }
  if (isNanpCountry(fallback)) return usPhoneError(raw)
  const parsed = parsePhoneNumberFromString(raw, fallback as CountryCode)
  if (!parsed || !parsed.isValid()) return 'Please enter a valid mobile number.'
  return null
}

export function isPossiblePhone(
  input: string | null | undefined,
  country: string | null | undefined = 'US'
): boolean {
  return phoneError(input, country) === null
}

// Every spelling of a number we might find in visitors.phone, for an
// `IN (...)` match against stored rows. The sign-in form submits
// "(512) 555-1234" for NANP numbers, so that is what nearly every row holds —
// but the API accepts any structurally-valid format from a crafted request
// and stores it as sent, so also try E.164, bare digits, and the input as
// typed. Non-NANP numbers are stored as E.164; their variants are E.164, the
// spaced international form, and the national form. Plain strings on
// purpose: a btree index on phone serves the IN() directly.
export function phoneMatchVariants(input: string | null | undefined): string[] {
  const raw = (input || '').trim()
  const out = new Set<string>()
  if (raw) out.add(raw)
  const digits = raw.replace(/\D/g, '')
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (d.length === 10 && !(raw.startsWith('+') && !raw.startsWith('+1'))) {
    out.add(`(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`)
    out.add(`+1${d}`)
    out.add(d)
  } else if (raw.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(raw)
    if (parsed && parsed.countryCallingCode !== '1') {
      out.add(parsed.number)
      out.add(parsed.formatInternational())
      out.add(parsed.formatNational())
    }
  }
  return [...out]
}

// Readable form for dashboards and emails. NANP numbers keep the familiar
// "(512) 555-1234"; anything else shows as "+61 412 345 678". Unparseable
// input is returned as typed.
export function formatPhoneDisplay(
  input: string | null | undefined,
  defaultCountry: string | null | undefined = 'US'
): string {
  const raw = (input || '').trim()
  if (!raw) return ''
  const e164 = normalizePhone(raw, defaultCountry)
  if (!e164) return raw
  const parsed = parsePhoneNumberFromString(e164)
  if (!parsed) return raw
  if (parsed.countryCallingCode === '1') {
    const n = parsed.nationalNumber
    return n.length === 10 ? `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}` : raw
  }
  return parsed.formatInternational()
}

// Which country a stored/typed number belongs to, when it can be told:
// E.164 input is parsed; national-format input is assumed to be in
// `defaultCountry`. Used to pick the visitor's message channel.
export function phoneCountry(
  input: string | null | undefined,
  defaultCountry: string | null | undefined = 'US'
): string | null {
  const e164 = normalizePhone(input, defaultCountry)
  if (!e164) return null
  return parsePhoneNumberFromString(e164)?.country ?? null
}

// Live input formatting for a national-format number in `country` —
// "0412345678" → "0412 345 678" for AU, "07911123456" → "07911 123456" for
// GB. NANP countries keep the app's own "(512) 555-1234" mask (the one every
// form has always used), so US/Canadian agents see nothing change.
export function formatNationalAsYouType(value: string, country: string | null | undefined): string {
  const code = normalizeCountry(country) ?? 'US'
  if (isNanpCountry(code)) return formatNanpAsYouType(value)
  // AsYouType keeps a leading "+" in international mode; we only want the
  // national number here, so strip it and let the picker own the dial code.
  const cleaned = value.replace(/[^\d]/g, '')
  if (!cleaned) return ''
  return new AsYouType(code as CountryCode).input(cleaned)
}

// The mask the sign-in form and Settings have always applied to US/Canadian
// numbers: digits only, capped at 10, "(XXX) XXX-XXXX" as you type. Lifted
// here from the four copies that used to live in page components.
export function formatNanpAsYouType(value: string): string {
  const digits = value.replace(/\D/g, '').substring(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

// What to store for a number entered in a country picker + national input:
// NANP → the legacy "(512) 555-1234"; everything else → E.164. Returns null
// when it can't be made into a number at all.
export function storablePhone(nationalOrE164: string, country: string | null | undefined): string | null {
  const raw = (nationalOrE164 || '').trim()
  if (!raw) return null
  const code = normalizeCountry(country) ?? 'US'
  if (raw.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(raw)
    if (!parsed) return null
    if (parsed.countryCallingCode === '1') {
      const n = parsed.nationalNumber
      return n.length === 10 ? formatNanpAsYouType(n) : null
    }
    return parsed.number
  }
  if (isNanpCountry(code)) {
    const digits = raw.replace(/\D/g, '')
    const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
    return d.length === 10 ? formatNanpAsYouType(d) : null
  }
  return normalizePhone(raw, code)
}

// Split a stored number back into picker country + national text for
// editing: "(512) 555-1234" → { country: 'US' (or the given default NANP
// country), national: "(512) 555-1234" }; "+61412345678" → { country: 'AU',
// national: "0412 345 678" }.
export function splitStoredPhone(
  stored: string | null | undefined,
  defaultCountry: string | null | undefined = 'US'
): { country: string; national: string } {
  const raw = (stored || '').trim()
  const fallback = normalizeCountry(defaultCountry) ?? 'US'
  if (!raw) return { country: fallback, national: '' }
  if (raw.startsWith('+') && !raw.startsWith('+1')) {
    const parsed = parsePhoneNumberFromString(raw)
    if (parsed?.country) return { country: parsed.country, national: parsed.formatNational() }
    return { country: fallback, national: raw }
  }
  // NANP (legacy display form, bare digits, or +1…): keep the agent's own
  // NANP country so a Canadian stays "CA" rather than flipping to US.
  const country = isNanpCountry(fallback) ? fallback : 'US'
  const digits = raw.replace(/\D/g, '')
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return { country, national: d.length === 10 ? formatNanpAsYouType(d) : raw }
}
