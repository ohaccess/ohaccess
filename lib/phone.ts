// Normalize a US phone number to E.164 (+1XXXXXXXXXX) so a number stored in one
// format — "(500) 555-0001" from the registration form, "+15005550001" from a
// Twilio callback — matches the same key in the opt-out list. Returns null if
// there aren't enough digits to be a usable number.
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null
  const digits = input.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length > 11 && input.trim().startsWith('+')) return `+${digits}` // already international
  return null
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
  if (d.length < 10) return 'Please enter a 10-digit US phone number.'
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
