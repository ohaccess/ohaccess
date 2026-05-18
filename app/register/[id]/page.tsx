'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const [openHouse, setOpenHouse] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [codeWord, setCodeWord] = useState('')
  const [selectedTimeline, setSelectedTimeline] = useState('')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  })
  const [errors, setErrors] = useState<any>({})

  useEffect(() => {
    const fetchOpenHouse = async () => {
      const { data, error } = await supabase
        .from('open_houses')
        .select('*, profiles(*)')
        .eq('id', id)
        .single()

      if (!error && data) {
        setOpenHouse(data)
      }
      setLoading(false)
    }
    fetchOpenHouse()
  }, [id])

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').substring(0, 10)
    if (digits.length === 0) return ''
    if (digits.length <= 3) return `(${digits}`
    if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  }

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
  }

  const validate = () => {
    const newErrors: any = {}
    const nameParts = `${form.firstName} ${form.lastName}`.trim().split(' ').filter(w => w.length > 0)
    if (nameParts.length < 2) newErrors.name = 'Please enter your first and last name'
    if (!validateEmail(form.email)) newErrors.email = 'Please enter a valid email address'
    if (form.phone.replace(/\D/g, '').length !== 10) newErrors.phone = 'Please enter a valid 10-digit phone number'
    if (!selectedTimeline) newErrors.timeline = 'Please select a purchasing timeline'
    return newErrors
  }

  const handleSubmit = async () => {
    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          purchasingTimeline: selectedTimeline,
          openHouseId: id
        })
      })
      const data = await res.json()
      if (data.success) {
        setCodeWord(data.codeWord)
        setSubmitted(true)
      } else {
        setErrors({ submit: data.error || 'Something went wrong. Please try again.' })
      }
    } catch {
      setErrors({ submit: 'Something went wrong. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <main style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ fontSize: '16px', color: '#6e6e73' }}>Loading...</div>
    </main>
  )

  if (!openHouse) return (
    <main style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ fontSize: '16px', color: '#6e6e73' }}>Open house not found.</div>
    </main>
  )

  const agent = openHouse.profiles
  const primaryColor = agent?.primary_color || '#1d1d1f'
  const accentColor = agent?.accent_color || '#0071e3'

  const inputStyle = {
    width: '100%',
    background: '#f5f5f7',
    border: '1px solid #d1d1d6',
    borderRadius: '9px',
    padding: '10px 12px',
    fontSize: '14px',
    color: '#1d1d1f',
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: "'Plus Jakarta Sans', sans-serif"
  }

  const labelStyle = {
    display: 'block' as const,
    fontSize: '11px',
    fontWeight: '600' as const,
    color: '#6e6e73',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '5px',
    marginTop: '13px'
  }

  const timelines = ['0–1 Month', '2–3 Months', '3–6 Months', '6–12 Months', '12+ Months']

  return (
    <main style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: '40px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: primaryColor, width: '100%', padding: '22px 20px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px' }}>
          oh<span style={{ fontWeight: '700' }}>ACCESS</span>
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
          Secure open house registration
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '400px', padding: '0 16px' }}>

        {!submitted ? (
          <>
            {/* Property info */}
            <div style={{ background: '#f5f5f7', borderRadius: '12px', padding: '12px 14px', margin: '16px 0', border: '1px solid #e5e5ea' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1d1d1f', marginBottom: '3px' }}>
                {openHouse.property_address}
              </div>
              <div style={{ fontSize: '12px', color: '#6e6e73' }}>
                {openHouse.bedrooms}bd · {openHouse.bathrooms}ba · {openHouse.square_footage} · {openHouse.listing_price}
              </div>
              <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '2px' }}>
                {openHouse.open_house_date} · {openHouse.open_house_hours} · {agent?.full_name}
              </div>
            </div>

            {/* Name fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>First Name <span style={{ color: '#ff3b30' }}>*</span></label>
                <input
                  style={{ ...inputStyle, border: errors.name ? '1px solid #ff3b30' : '1px solid #d1d1d6' }}
                  type="text"
                  placeholder="First"
                  value={form.firstName}
                  onChange={e => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>Last Name <span style={{ color: '#ff3b30' }}>*</span></label>
                <input
                  style={{ ...inputStyle, border: errors.name ? '1px solid #ff3b30' : '1px solid #d1d1d6' }}
                  type="text"
                  placeholder="Last"
                  value={form.lastName}
                  onChange={e => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            {errors.name && <div style={{ fontSize: '11px', color: '#ff3b30', marginTop: '4px' }}>{errors.name}</div>}

            {/* Email */}
            <label style={labelStyle}>Valid Email Address <span style={{ color: '#ff3b30' }}>*</span></label>
            <input
              style={{ ...inputStyle, border: errors.email ? '1px solid #ff3b30' : '1px solid #d1d1d6' }}
              type="email"
              placeholder="you@email.com"
              value={form.email}
              onChange={e => {
                setForm({ ...form, email: e.target.value })
                if (errors.email) setErrors({ ...errors, email: null })
              }}
              onBlur={() => {
                if (!validateEmail(form.email) && form.email) {
                  setErrors({ ...errors, email: 'Please enter a valid email address' })
                }
              }}
            />
            {errors.email && <div style={{ fontSize: '11px', color: '#ff3b30', marginTop: '4px' }}>{errors.email}</div>}

            {/* Phone */}
            <label style={labelStyle}>Valid Phone Number <span style={{ color: '#ff3b30' }}>*</span></label>
            <input
              style={{ ...inputStyle, border: errors.phone ? '1px solid #ff3b30' : '1px solid #d1d1d6' }}
              type="tel"
              placeholder="(000) 000-0000"
              value={form.phone}
              onChange={e => {
                setForm({ ...form, phone: formatPhone(e.target.value) })
                if (errors.phone) setErrors({ ...errors, phone: null })
              }}
              onBlur={() => {
                if (form.phone.replace(/\D/g, '').length !== 10 && form.phone) {
                  setErrors({ ...errors, phone: 'Please enter a valid 10-digit phone number' })
                }
              }}
            />
            {errors.phone && <div style={{ fontSize: '11px', color: '#ff3b30', marginTop: '4px' }}>{errors.phone}</div>}

            {/* Timeline */}
            <label style={labelStyle}>Purchasing Timeline <span style={{ color: '#ff3b30' }}>*</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
              {timelines.map(t => (
                <div
                  key={t}
                  onClick={() => { setSelectedTimeline(t); setErrors({ ...errors, timeline: null }) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    background: selectedTimeline === t ? '#f0f0f0' : '#f5f5f7',
                    border: selectedTimeline === t ? `1px solid ${primaryColor}` : '1px solid #d1d1d6',
                    borderRadius: '9px',
                    padding: '9px 11px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: selectedTimeline === t ? primaryColor : '#6e6e73',
                    fontWeight: selectedTimeline === t ? '600' : '400',
                    gridColumn: t === '12+ Months' ? '1 / -1' : 'auto'
                  }}
                >
                  <div style={{
                    width: '13px',
                    height: '13px',
                    borderRadius: '50%',
                    border: selectedTimeline === t ? `1.5px solid ${primaryColor}` : '1.5px solid #d1d1d6',
                    background: selectedTimeline === t ? primaryColor : 'transparent',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {selectedTimeline === t && (
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'white' }} />
                    )}
                  </div>
                  {t}
                </div>
              ))}
            </div>
            {errors.timeline && <div style={{ fontSize: '11px', color: '#ff3b30', marginTop: '4px' }}>{errors.timeline}</div>}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                display: 'block',
                width: '100%',
                marginTop: '18px',
                padding: '14px',
                backgroundColor: primaryColor,
                color: '#ffffff',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: '15px',
                fontWeight: '700',
                border: 'none',
                borderRadius: '12px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? 'Sending your code...' : 'Request Access Code →'}
            </button>

            {errors.submit && (
              <div style={{ marginTop: '10px', padding: '10px', background: '#fff0f0', borderRadius: '8px', fontSize: '13px', color: '#cc0000' }}>
                {errors.submit}
              </div>
            )}

            {/* TOS */}
            <div style={{ marginTop: '14px', padding: '12px 14px', background: '#f5f5f7', borderRadius: '10px', fontSize: '11px', color: '#6e6e73', lineHeight: '1.65', textAlign: 'center', border: '1px solid #e5e5ea' }}>
              By requesting an access code you are agreeing to the{' '}
              <a href="/terms" style={{ color: '#1d1d1f', fontWeight: '700', textDecoration: 'underline' }}>
                ohACCESS Terms of Service & Privacy Policy
              </a>.<br /><br />
              You consent to be contacted by the listing agent via phone, text, and email regarding this and other properties.
            </div>
          </>
        ) : (
          /* Success screen */
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#e8f9ee', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
              ✓
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f', marginBottom: '6px' }}>
              You&apos;re in!
            </div>
            <p style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '16px' }}>
              Show this code at the door to gain access.
            </p>
            <div style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '4px', color: '#1d1d1f', background: '#f5f5f7', border: '1px dashed #d1d1d6', borderRadius: '12px', padding: '14px 20px', display: 'inline-block', marginBottom: '16px' }}>
              {codeWord}
            </div>
            <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '14px' }}>
              {openHouse.property_address}<br />
              {openHouse.open_house_date} · {openHouse.open_house_hours}
            </div>
            <div style={{ fontSize: '12px', color: '#30d158', fontWeight: '600' }}>
              ✓ Your code was sent to your phone and email
            </div>
            <div style={{ fontSize: '12px', color: '#30d158', fontWeight: '600', marginTop: '4px' }}>
              ✓ Agent has been notified of your arrival
            </div>
          </div>
        )}
      </div>
    </main>
  )
}