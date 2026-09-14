'use client'
import { useState, type CSSProperties } from 'react'
import PhoneInput, { type PhoneValue } from '@/app/_components/PhoneInput'
import { TIMELINE_VALUES } from '@/lib/register-i18n'

// "+ Add visitor" in the visitor log: the agent types in someone who couldn't
// sign in with the QR code. Saved by POST /api/open-house/[id]/visitors, which
// marks the row as added by hand and sends nothing.

export default function AddVisitorModal({
  oh,
  defaultCountry,
  onClose,
  onAdded,
  authHeaders,
  primaryColor,
  onPrimary,
  primaryBtnBorder,
  inputStyle,
  labelStyle,
}: {
  oh: { id: string; property_address?: string | null; country?: string | null }
  defaultCountry: string
  onClose: () => void
  onAdded: () => void
  authHeaders: () => Promise<HeadersInit>
  primaryColor: string
  onPrimary: string
  primaryBtnBorder: string
  inputStyle: CSSProperties
  labelStyle: CSSProperties
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState<PhoneValue>({ country: oh?.country || defaultCountry, national: '' })
  const [email, setEmail] = useState('')
  const [timeline, setTimeline] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setError('')
    if (!firstName.trim()) { setError('Please enter the visitor’s first name.'); return }
    if (!phone.national.trim() && !email.trim()) { setError('Please enter a mobile number or an email so you can follow up.'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/open-house/${oh.id}/visitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ firstName, lastName, phone: phone.national, phoneCountry: phone.country, email, timeline, notes }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Could not add the visitor. Please try again.'); return }
      onAdded()
    } catch {
      setError('Could not add the visitor. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}
      onClick={() => { if (!busy) onClose() }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '24px', maxWidth: '460px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '18px', fontWeight: '700', color: '#1d1d1f', marginBottom: '4px' }}>Add a visitor</div>
        <div style={{ fontSize: '12px', color: '#6e6e73', marginBottom: '4px' }}>{oh.property_address}</div>
        <div style={{ fontSize: '12px', color: '#6e6e73', lineHeight: '1.55', background: '#f5f5f7', borderRadius: '10px', padding: '10px 12px', margin: '12px 0 16px' }}>
          For someone who couldn&apos;t sign in with the QR code. They won&apos;t get a codeword or any emails from ohACCESS, and they&apos;re marked <strong>✋ Added by you</strong>{' '}since their details weren&apos;t checked.
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>First name</label>
              <input style={inputStyle} value={firstName} maxLength={60} autoFocus onChange={e => setFirstName(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Last name</label>
              <input style={inputStyle} value={lastName} maxLength={60} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Mobile</label>
            <PhoneInput value={phone} inputStyle={inputStyle} onChange={setPhone} />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <div style={{ fontSize: '11px', color: '#6e6e73', marginTop: '4px' }}>A mobile number or an email is required.</div>
          </div>
          <div>
            <label style={labelStyle}>Buying timeline</label>
            <select style={{ ...inputStyle, appearance: 'auto' as const, cursor: 'pointer' }} value={timeline} onChange={e => setTimeline(e.target.value)}>
              <option value="">Not sure</option>
              {TIMELINE_VALUES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={notes} maxLength={2000} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: '14px', background: '#fff0f0', color: '#cc0000', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.5' }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
          <button disabled={busy} onClick={onClose} style={{ padding: '10px 18px', background: '#e8e8ed', color: '#1d1d1f', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
          <button disabled={busy} onClick={save} style={{ padding: '10px 18px', background: primaryColor, color: onPrimary, border: primaryBtnBorder, borderRadius: '9px', fontSize: '14px', fontWeight: '600', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{busy ? 'Adding…' : 'Add visitor'}</button>
        </div>
      </div>
    </div>
  )
}
