'use client'
import { useMemo, type CSSProperties } from 'react'
import { parsePhoneNumberFromString } from 'libphonenumber-js/min'
import { countryOptions, flagFor, dialCodeFor, regionFor, normalizeCountry, mainCountryForCallingCode } from '@/lib/regions'
import { formatNationalAsYouType } from '@/lib/phone'

// Country picker + national-number input, used wherever someone types a
// phone number that ohACCESS will text: the visitor sign-in form and the
// agent's own number in Settings.
//
// The picker shows a flag and dial code ("🇦🇺 +61"); the list behind it is a
// plain native <select> (keyboard + screen-reader friendly, and the OS wheel
// on phones) laid invisibly over the styled chip. The number field formats
// as you type in that country's national style — US/Canada keep the exact
// "(512) 555-1234" mask the forms have always had, so nothing changes for
// them; an Australian sees "0412 345 678", a Brit "07911 123456".
//
// The component deals in { country, national } only. Turning that into the
// stored string (legacy "(512) 555-1234" for +1 countries, E.164 for the
// rest) is storablePhone() in lib/phone.ts, and the reverse for editing is
// splitStoredPhone() — keep the conversion at the edges, not in here.

export type PhoneValue = { country: string; national: string }

export default function PhoneInput({
  value,
  onChange,
  inputStyle,
  placeholder,
  error = false,
  onBlur,
  disabled = false,
  ariaLabel = 'Mobile number',
}: {
  value: PhoneValue
  onChange: (next: PhoneValue) => void
  // The host form's input style so the two pieces match their neighbours.
  inputStyle: CSSProperties
  placeholder?: string
  error?: boolean
  onBlur?: () => void
  disabled?: boolean
  ariaLabel?: string
}) {
  const options = useMemo(() => countryOptions(), [])
  const country = normalizeCountry(value.country) ?? 'US'
  const region = regionFor(country)

  const chipStyle: CSSProperties = {
    ...inputStyle,
    width: 'auto',
    flex: '0 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    paddingRight: '26px',
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
    position: 'relative',
    userSelect: 'none',
    border: error ? '1px solid #ff3b30' : inputStyle.border,
  }

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch', width: '100%' }}>
      <div style={chipStyle} aria-hidden={false}>
        <span style={{ fontSize: '1.1em', lineHeight: 1 }}>{flagFor(country)}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{dialCodeFor(country)}</span>
        {/* caret */}
        <span style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: '#6e6e73', pointerEvents: 'none' }}>▼</span>
        <select
          aria-label="Country code"
          value={country}
          disabled={disabled}
          onChange={e => {
            const next = normalizeCountry(e.target.value) ?? 'US'
            // Re-shape whatever has been typed for the new country's plan.
            const digits = value.national.replace(/\D/g, '')
            onChange({ country: next, national: formatNationalAsYouType(digits, next) })
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '16px', // keeps iOS from zooming when the list opens
          }}
        >
          {options.map(o => (
            <option key={o.code} value={o.code}>
              {flagFor(o.code)} {o.name} ({o.dialCode})
            </option>
          ))}
        </select>
      </div>
      <input
        style={{ ...inputStyle, flex: '1 1 auto', minWidth: 0, border: error ? '1px solid #ff3b30' : inputStyle.border }}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        aria-label={ariaLabel}
        placeholder={placeholder ?? region.phonePlaceholder}
        value={value.national}
        disabled={disabled}
        onChange={e => {
          const typed = e.target.value
          // Someone pasting a full "+61 412 345 678" into the number box:
          // honour the "+" by switching the picker rather than mangling it.
          // The parser places a number by area code where it can (+1 416 →
          // CA, a Guernsey mobile → GG); where the metadata can't tell (a UK
          // mobile is +44 like Guernsey/Jersey/Isle of Man), the calling
          // code's main country wins (GB). formatNational() restores the
          // trunk prefix ("0412 345 678"), which the as-you-type mask can't
          // from bare digits.
          if (typed.trim().startsWith('+')) {
            const digits = typed.replace(/\D/g, '')
            const parsed = parsePhoneNumberFromString(typed.trim())
            const parsedCountry = parsed?.country ?? mainCountryForCallingCode(parsed?.countryCallingCode)
            if (parsed && parsedCountry) {
              onChange({ country: parsedCountry, national: parsed.formatNational() })
              return
            }
            const match = bestCountryForDigits(digits, options)
            if (match) {
              const cc = match.dialCode.slice(1)
              onChange({ country: match.code, national: formatNationalAsYouType(digits.slice(cc.length), match.code) })
              return
            }
          }
          onChange({ country, national: formatNationalAsYouType(typed, country) })
        }}
        onBlur={onBlur}
      />
    </div>
  )
}

// Longest dial-code match for pasted international digits the parser can't
// make anything of yet (just "+6"). Shared codes resolve to the calling
// code's main country; once enough digits arrive the parser above takes over.
function bestCountryForDigits(
  digits: string,
  options: { code: string; dialCode: string }[]
): { code: string; dialCode: string } | null {
  let best: { code: string; dialCode: string } | null = null
  for (const o of options) {
    const cc = o.dialCode.slice(1)
    if (digits.startsWith(cc) && (!best || cc.length > best.dialCode.length - 1)) best = o
  }
  if (!best) return null
  const main = mainCountryForCallingCode(best.dialCode.slice(1))
  return main ? { code: main, dialCode: best.dialCode } : best
}
