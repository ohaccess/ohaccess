// FOREWARN (forewarn.com) is the US agent-safety lookup most real estate
// associations include as a member benefit: paste a phone number, get an
// identity + records report on the person you're about to meet.
//
// It publishes no way for another app to hand it a number (checked
// 2026-10-06): no URL scheme, no universal-link / app-link files on
// app.forewarn.com, and a ?phone= parameter on the web app is ignored. Its
// one CRM integration (Follow Up Boss) is a private partner build. So the
// best we can do today is copy the number to the clipboard and open the
// FOREWARN web app for the agent to paste into. If FOREWARN gives us a real
// integration, this file and the button in app/_components/VisitorDetail.tsx
// are the only places that change.
export const FOREWARN_URL = 'https://app.forewarn.com/'

// FOREWARN covers US numbers only. Our +1 rows are stored as "(512) 555-1234"
// and everything else as E.164 with a leading "+" (lib/phone.ts), so a number
// that starts with "+" but not "+1" is foreign and gets no button. Returns the
// 10 national digits FOREWARN's search box takes, or null when there's nothing
// sensible to search.
export function forewarnSearchDigits(phone: string | null | undefined): string | null {
  if (!phone) return null
  const raw = phone.trim()
  if (raw.startsWith('+') && !raw.startsWith('+1')) return null
  const digits = raw.replace(/\D/g, '')
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return national.length === 10 ? national : null
}
