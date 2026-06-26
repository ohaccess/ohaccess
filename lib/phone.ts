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
