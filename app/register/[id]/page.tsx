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
  const [selectedTimeline, setSelectedTimeline] = useState('')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  }
)
function ExpiredOpenHouse() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', zip: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<any>({})

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').substring(0, 10)
    if (digits.length === 0) return ''
    if (digits.length <= 3) return `(${digits}`
    if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  }

  const handleSubmit = async () => {
    const newErrors: any = {}
    if (!form.name.trim()) newErrors.name = 'Please enter your name'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) newErrors.email = 'Please enter a valid email'
    if (form.phone.replace(/\D/g, '').length !== 10) newErrors.phone = 'Please enter a valid phone number'
    if (!form.zip.trim()) newErrors.zip = 'Please enter your zip code'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }

    setSubmitting(true)
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          brokerage: `Buyer Lead — Zip: ${form.zip}`,
          agentCount: 'N/A',
          message: `Buyer lead from expired QR code. Name: ${form.name}, Email: ${form.email}, Phone: ${form.phone}, Zip: ${form.zip}`
        })
      })
      setSubmitted(true)
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

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
    marginTop: '12px'
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '24px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ background: 'white', borderRadius: '22px', border: '1px solid #d1d1d6', padding: '32px 28px', maxWidth: '380px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '22px', fontWeight: '200', color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '16px' }}>
            oh<span style={{ fontWeight: '700' }}>ACCESS</span>
          </div>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🏠</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>
            This open house has ended
          </div>
          <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.6' }}>
            But your home search doesn't have to. Leave your info and we'll connect you with a local agent who can help.
          </div>
        </div>

        {!submitted ? (
          <>
            <div>
              <label style={labelStyle}>Your Name <span style={{ color: '#ff3b30' }}>*</span></label>
              <input
                style={{ ...inputStyle, border: errors.name ? '1px solid #ff3b30' : '1px solid #d1d1d6' }}
                type="text"
                placeholder="First and last name"
                value={form.name}
                onChange={e => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: null }) }}
              />
              {errors.name && <div style={{ fontSize: '11px', color: '#ff3b30', marginTop: '4px' }}>{errors.name}</div>}
            </div>

            <div>
              <label style={labelStyle}>Email Address <span style={{ color: '#ff3b30' }}>*</span></label>
              <input
                style={{ ...inputStyle, border: errors.email ? '1px solid #ff3b30' : '1px solid #d1d1d6' }}
                type="email"
                placeholder="you@email.com"
                value={form.email}
                onChange={e => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: null }) }}
              />
              {errors.email && <div style={{ fontSize: '11px', color: '#ff3b30', marginTop: '4px' }}>{errors.email}</div>}
            </div>

            <div>
              <label style={labelStyle}>Phone Number <span style={{ color: '#ff3b30' }}>*</span></label>
              <input
                style={{ ...inputStyle, border: errors.phone ? '1px solid #ff3b30' : '1px solid #d1d1d6' }}
                type="tel"
                placeholder="(000) 000-0000"
                value={form.phone}
                onChange={e => { setForm({ ...form, phone: formatPhone(e.target.value) }); setErrors({ ...errors, phone: null }) }}
              />
              {errors.phone && <div style={{ fontSize: '11px', color: '#ff3b30', marginTop: '4px' }}>{errors.phone}</div>}
            </div>

            <div>
              <label style={labelStyle}>Zip Code <span style={{ color: '#ff3b30' }}>*</span></label>
              <input
                style={{ ...inputStyle, border: errors.zip ? '1px solid #ff3b30' : '1px solid #d1d1d6' }}
                type="text"
                placeholder="75201"
                value={form.zip}
                onChange={e => { setForm({ ...form, zip: e.target.value }); setErrors({ ...errors, zip: null }) }}
                maxLength={5}
              />
              {errors.zip && <div style={{ fontSize: '11px', color: '#ff3b30', marginTop: '4px' }}>{errors.zip}</div>}
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ display: 'block', width: '100%', marginTop: '20px', padding: '14px', background: '#1d1d1f', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Submitting...' : 'Connect me with an agent →'}
            </button>

            <div style={{ marginTop: '12px', fontSize: '11px', color: '#aeaeb2', textAlign: 'center', lineHeight: '1.6' }}>
              By submitting you agree to be contacted by a licensed real estate agent.
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#1d1d1f', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
              ✓
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>
              You're on the list!
            </div>
            <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.6' }}>
              A local agent will be in touch shortly to help with your home search.
            </div>
            <a href="https://ohaccess.com" style={{ display: 'inline-block', marginTop: '20px', color: '#6e6e73', fontSize: '12px', textDecoration: 'none' }}>
              Powered by ohACCESS
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
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

  if (!openHouse) return <ExpiredOpenHouse />

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
                {openHouse.bedrooms} bed · {openHouse.bathrooms} bath · {openHouse.square_footage} sq ft · {openHouse.listing_price}
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
              By entering your number and tapping <strong style={{ color: '#1d1d1f' }}>Request Access Code</strong>, you agree to receive a one-time SMS access code from ohACCESS to enter this open house. Message &amp; data rates may apply. Reply STOP to opt out, HELP for help.<br /><br />
              You also agree to the{' '}
              <a href="/terms" style={{ color: '#1d1d1f', fontWeight: '700', textDecoration: 'underline' }}>
                ohACCESS Terms of Service & Privacy Policy
              </a>, and consent to be contacted by the listing agent via phone, text, and email about this and other properties.
            </div>

            {/* Alternative to acceptance — preserves the validity of consent
                by giving the visitor an obvious, named alternative path. */}
            <div style={{ marginTop: '10px', padding: '12px 14px', background: '#fdfaf3', borderRadius: '10px', fontSize: '11px', color: '#6e6e73', lineHeight: '1.65', textAlign: 'center', border: '1px solid #ead9ad' }}>
              <strong style={{ color: '#1d1d1f' }}>Prefer not to register?</strong> You&apos;re welcome to schedule a private showing of this — or any — listed property with the buyer&apos;s agent of your choice. Under NAR rules effective August&nbsp;17,&nbsp;2024, you&apos;ll need a written buyer representation agreement with that agent before they can show you the home; most agents can prepare one on the spot. ohACCESS registration is required only to attend today&apos;s open house.
            </div>
          </>
        ) : (
          /* Success screen */
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
              ✓
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f', marginBottom: '6px' }}>
              Thank you!
            </div>
            <div style={{ fontSize: '14px', color: '#6e6e73', background: '#f5f5f7', borderRadius: '12px', padding: '14px 20px', marginBottom: '16px', lineHeight: '1.6' }}>
Your access code was texted to your phone, with a backup code sent to your email. <br/><br/>At the door, show or mention your text code to the host to gain access.
            </div>
            <div style={{ fontSize: '15px', color: '#6e6e73', marginBottom: '14px' }}>
              {openHouse.property_address}<br />
              {openHouse.open_house_date} · {openHouse.open_house_hours}
            </div>
            <div style={{ fontSize: '12px', color: accentColor, fontWeight: '600' }}>
                ✓ Access code was sent to your phone.
              </div>
              <div style={{ fontSize: '12px', color: accentColor, fontWeight: '600', marginTop: '4px' }}>
                ✓ Backup code was sent to your email.
              </div>
              <div style={{ fontSize: '12px', color: accentColor, fontWeight: '600', marginTop: '4px' }}>
                ✓ Agent has been notified of your arrival.
              </div>
          </div>
        )}
      </div>
    </main>
  )
}