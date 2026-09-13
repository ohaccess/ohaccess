'use client'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import PhoneInput, { type PhoneValue } from '@/app/_components/PhoneInput'
import { countryOptions, flagFor } from '@/lib/regions'
import { splitStoredPhone, storablePhone, formatNationalAsYouType } from '@/lib/phone'
import { licenceRequirement, VERIFY_CODE_LENGTH, VERIFY_RESEND_COOLDOWN_SECONDS } from '@/lib/agent-verification'

// Shown in place of the New Open House form until the agent has verified
// (lib/agent-verification.ts). Step 1: country, licence (where required) and
// mobile number → "Text me a code". Step 2: enter the code → verified, and the
// form appears.

export default function AgentVerificationCard({
  profile,
  agentCountry,
  authHeaders,
  onVerified,
  onCancel,
  primaryColor,
  onPrimary,
  primaryBtnBorder,
  inputStyle,
  labelStyle,
}: {
  profile: { phone?: string | null; license_number?: string | null; state?: string | null } | null
  agentCountry: string
  authHeaders: () => Promise<HeadersInit>
  onVerified: (patch: Record<string, unknown>) => void
  onCancel: () => void
  primaryColor: string
  onPrimary: string
  primaryBtnBorder: string
  inputStyle: CSSProperties
  labelStyle: CSSProperties
}) {
  const countries = useMemo(() => countryOptions(), [])
  const [country, setCountry] = useState(agentCountry)
  const [phone, setPhone] = useState<PhoneValue>(() => splitStoredPhone(profile?.phone, agentCountry))
  const [licenseNumber, setLicenseNumber] = useState<string>(profile?.license_number || '')
  const [licenseState, setLicenseState] = useState<string>((profile?.state || '').toUpperCase())
  const [step, setStep] = useState<'details' | 'code'>('details')
  const [code, setCode] = useState('')
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  const licence = licenceRequirement(country)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/agent-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, json }
  }

  const phoneForApi = () => storablePhone(phone.national, phone.country) ?? phone.national

  const sendCode = async () => {
    setError('')
    if (licence) {
      if (licenseNumber.trim().length < 3) { setError(`Please enter your ${licence.numberLabel.toLowerCase()}.`); return }
      if (licence.regionLabel && licence.regions && !licence.regions.some(r => r.code === licenseState)) {
        setError(`Please choose the ${licence.regionLabel.toLowerCase()} that issued your licence.`)
        return
      }
    }
    if (!phone.national.trim()) { setError('Please enter your mobile number.'); return }
    setBusy(true)
    try {
      const { ok, json } = await post({ action: 'send', phone: phoneForApi(), country: phone.country })
      if (json.verified) { onVerified({ agent_verified_at: new Date().toISOString() }); return }
      if (!ok) { setError(json.error || 'We couldn’t send the code. Please try again.'); return }
      setChannel(json.channel === 'whatsapp' ? 'whatsapp' : 'sms')
      setStep('code')
      setCode('')
      setCooldown(VERIFY_RESEND_COOLDOWN_SECONDS)
    } catch {
      setError('We couldn’t send the code. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    setError('')
    if (code.replace(/\D/g, '').length !== VERIFY_CODE_LENGTH) { setError(`Enter the ${VERIFY_CODE_LENGTH}-digit code.`); return }
    setBusy(true)
    try {
      const { ok, json } = await post({ action: 'confirm', code, country, licenseNumber, licenseState })
      if (!ok) { setError(json.error || 'That didn’t work. Please try again.'); return }
      onVerified(json.profile || { agent_verified_at: new Date().toISOString() })
    } catch {
      setError('That didn’t work. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const primaryBtn: CSSProperties = { padding: '10px 18px', background: primaryColor, color: onPrimary, border: primaryBtnBorder, borderRadius: '9px', fontSize: '14px', fontWeight: '600', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }
  const linkBtn: CSSProperties = { background: 'none', border: 'none', padding: 0, color: '#0071e3', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }
  const stepDot = (n: number, active: boolean) => (
    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: active ? primaryColor : '#e8e8ed', color: active ? onPrimary : '#6e6e73', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>{n}</span>
  )

  return (
    <>
      <div style={{ fontSize: '24px', fontWeight: '600', color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>Verify your account</div>
      <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '24px', lineHeight: '1.5' }}>
        One quick step before your first open house. It keeps ohACCESS for real estate professionals and protects your visitors. It takes about a minute, and you only do it once.
      </div>

      <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px', maxWidth: '560px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>
          {stepDot(1, step === 'details')}
          <span style={{ fontSize: '13px', fontWeight: '600', color: step === 'details' ? '#1d1d1f' : '#6e6e73' }}>Your details</span>
          <span style={{ color: '#d1d1d6' }}>›</span>
          {stepDot(2, step === 'code')}
          <span style={{ fontSize: '13px', fontWeight: '600', color: step === 'code' ? '#1d1d1f' : '#6e6e73' }}>Enter your code</span>
        </div>

        {step === 'details' ? (
          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Country where you work</label>
              <select
                style={{ ...inputStyle, appearance: 'auto' as const, cursor: 'pointer' }}
                value={country}
                onChange={e => {
                  const next = e.target.value
                  setCountry(next)
                  const digits = phone.national.replace(/\D/g, '')
                  setPhone({ country: next, national: digits ? formatNationalAsYouType(digits, next) : '' })
                  setLicenseState('')
                }}
              >
                {countries.map(c => (
                  <option key={c.code} value={c.code}>{c.name} {flagFor(c.code)}</option>
                ))}
              </select>
            </div>

            {licence && (
              <div style={{ display: 'grid', gridTemplateColumns: licence.regionLabel && licence.regions ? '1fr 1fr' : '1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>{licence.numberLabel}</label>
                  <input style={inputStyle} type="text" maxLength={40} placeholder={licence.numberPlaceholder} value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} />
                </div>
                {licence.regionLabel && licence.regions && (
                  <div>
                    <label style={labelStyle}>{licence.regionLabel}</label>
                    <select style={{ ...inputStyle, appearance: 'auto' as const, cursor: 'pointer' }} value={licenseState} onChange={e => setLicenseState(e.target.value)}>
                      <option value="">Select…</option>
                      {licence.regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div>
              <label style={labelStyle}>Your mobile number</label>
              <PhoneInput value={phone} inputStyle={inputStyle} onChange={setPhone} />
              <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '6px', lineHeight: '1.5' }}>
                We&apos;ll send a 6-digit code to this number. Use a real mobile: internet and app numbers (like Google Voice) and landlines won&apos;t work.
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '14px', color: '#1d1d1f', lineHeight: '1.6', marginBottom: '14px' }}>
              We sent a {VERIFY_CODE_LENGTH}-digit code {channel === 'whatsapp' ? 'on WhatsApp ' : 'by text '}to <strong>{phone.national}</strong>. Enter it below. It expires in 10 minutes.
            </div>
            <label style={labelStyle}>Verification code</label>
            <input
              style={{ ...inputStyle, maxWidth: '200px', fontSize: '20px', fontWeight: '700', letterSpacing: '6px' }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={VERIFY_CODE_LENGTH}
              placeholder="000000"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, VERIFY_CODE_LENGTH))}
              onKeyDown={e => { if (e.key === 'Enter') confirm() }}
            />
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px', fontSize: '13px' }}>
              {cooldown > 0 ? (
                <span style={{ color: '#6e6e73' }}>Didn&apos;t get it? You can send a new code in {cooldown}s</span>
              ) : (
                <button type="button" disabled={busy} onClick={sendCode} style={linkBtn}>Send a new code</button>
              )}
              <button type="button" disabled={busy} onClick={() => { setStep('details'); setError('') }} style={linkBtn}>Use a different number</button>
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: '14px', background: '#fff0f0', color: '#cc0000', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.5' }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '8px', maxWidth: '560px' }}>
        <button onClick={onCancel} style={{ padding: '10px 18px', background: '#e8e8ed', color: '#1d1d1f', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
        {step === 'details' ? (
          <button disabled={busy} onClick={sendCode} style={primaryBtn}>{busy ? 'Sending…' : 'Send my code'}</button>
        ) : (
          <button disabled={busy} onClick={confirm} style={primaryBtn}>{busy ? 'Checking…' : '✓ Verify and continue'}</button>
        )}
      </div>
    </>
  )
}
