'use client'
import React, { useState, useEffect } from 'react'
import { isLightColor, onColor, readableOnLight, fillBorder } from '@/lib/colors'
import { usPhoneError } from '@/lib/phone'
import { STRINGS, LANGS, TIMELINE_VALUES, FEEDBACK_PRICE_VALUES, detectLang, saveLang, type Lang } from '@/lib/register-i18n'

export default function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const [openHouse, setOpenHouse] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [selectedTimeline, setSelectedTimeline] = useState('')
  // Post-visit feedback (success screen). feedbackToken is returned by
  // /api/register and lets this browser submit feedback for this visitor once.
  const [feedbackToken, setFeedbackToken] = useState<string | null>(null)
  const [fbRating, setFbRating] = useState<number | null>(null)
  const [fbPriceIdx, setFbPriceIdx] = useState<number | null>(null)
  const [fbSubmitting, setFbSubmitting] = useState(false)
  const [fbDone, setFbDone] = useState(false)
  const [fbError, setFbError] = useState(false)
  // Visitor-facing copy is translated; lang starts as English on the server
  // render and snaps to the saved/device language on mount.
  const [lang, setLang] = useState<Lang>('en')
  const [langOpen, setLangOpen] = useState(false)
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
    const phoneErr = usPhoneError(form.phone)
    if (phoneErr) newErrors.phone = phoneErr
    if (!form.zip.trim()) newErrors.zip = 'Please enter your zip / postal code'
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
    // 16px is the threshold below which iOS Safari auto-zooms the page when a
    // field is focused. Keeping inputs at 16px stops that jump while leaving
    // the visitor's own pinch-to-zoom untouched (unlike maximum-scale hacks).
    fontSize: '16px',
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
              <label style={labelStyle}>Zip / Postal Code <span style={{ color: '#ff3b30' }}>*</span></label>
              <input
                style={{ ...inputStyle, border: errors.zip ? '1px solid #ff3b30' : '1px solid #d1d1d6' }}
                type="text"
                placeholder="75201"
                value={form.zip}
                onChange={e => { setForm({ ...form, zip: e.target.value }); setErrors({ ...errors, zip: null }) }}
                maxLength={7}
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
            <div style={{ marginTop: '20px', fontSize: '12px', color: '#6e6e73' }}>
              <a href="https://ohaccess.com" style={{ color: '#6e6e73', textDecoration: 'none' }}>Powered by ohACCESS</a> · <span style={{ fontWeight: '600' }}>Patent Pending</span>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
  const [errors, setErrors] = useState<any>({})

  const t = STRINGS[lang]
  const chooseLang = (code: Lang) => {
    setLang(code)
    saveLang(code)
    setLangOpen(false)
    // Re-worded error messages would be stale in the old language.
    setErrors({})
  }

  useEffect(() => { setLang(detectLang()) }, [])

  useEffect(() => {
    const fetchOpenHouse = async () => {
      // Fetch via a server route that returns ONLY safe display fields (no
      // code words, no agent PII). The open_houses/profiles tables are locked
      // down by RLS, so they must not be read with the public key here.
      try {
        const res = await fetch(`/api/open-house/${id}`)
        if (res.ok) {
          const data = await res.json()
          setOpenHouse(data)
        }
      } catch {
        // leave openHouse null -> ExpiredOpenHouse fallback renders
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

  // usPhoneError's specific messages ("area code can't start with...") only
  // exist in English; other languages get the generic translated message.
  const phoneErrMsg = (value: string) => {
    const err = usPhoneError(value)
    if (!err) return null
    return lang === 'en' ? err : t.errPhone
  }

  const validate = () => {
    const newErrors: any = {}
    const nameParts = `${form.firstName} ${form.lastName}`.trim().split(' ').filter(w => w.length > 0)
    if (nameParts.length < 2) newErrors.name = t.errName
    if (!validateEmail(form.email)) newErrors.email = t.errEmail
    const phoneErr = phoneErrMsg(form.phone)
    if (phoneErr) newErrors.phone = phoneErr
    if (!selectedTimeline) newErrors.timeline = t.errTimeline
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
          openHouseId: id,
          lang
        })
      })
      const data = await res.json()
      if (data.success) {
        if (data.feedbackToken) setFeedbackToken(data.feedbackToken)
        setSubmitted(true)
      } else {
        // Server errors (rate limits, trial caps) are specific and
        // English-only; show them verbatim rather than a vaguer translation.
        setErrors({ submit: data.error || t.errSubmit })
      }
    } catch {
      setErrors({ submit: t.errSubmit })
    } finally {
      setSubmitting(false)
    }
  }

  const submitFeedback = async () => {
    if (!feedbackToken || fbRating === null || fbPriceIdx === null) return
    setFbSubmitting(true)
    setFbError(false)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: feedbackToken,
          rating: fbRating,
          // Submit the canonical English value, not the translated label.
          price: FEEDBACK_PRICE_VALUES[fbPriceIdx],
        }),
      })
      const data = await res.json()
      if (data.success) setFbDone(true)
      else setFbError(true)
    } catch {
      setFbError(true)
    } finally {
      setFbSubmitting(false)
    }
  }

  if (loading) return (
    <main style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ fontSize: '16px', color: '#6e6e73' }}>{t.loading}</div>
    </main>
  )

  if (!openHouse) return <ExpiredOpenHouse />

  const agent = openHouse.profiles
  const primaryColor = agent?.primary_color || '#1d1d1f'
  const accentColor = agent?.accent_color || '#0071e3'
  // Keep this public sign-in page legible whatever brand colors the agent
  // picked, including white / near-white (see lib/colors).
  const primaryIsLight = isLightColor(primaryColor)
  const onPrimary = onColor(primaryColor)
  const primaryText = readableOnLight(primaryColor)
  const primaryBtnBorder = fillBorder(primaryColor)
  const accentText = readableOnLight(accentColor)
  // Text/symbols sitting ON an accent-filled shape (checkmark, selected rating
  // and price buttons): white on dark brand colors, black on light ones.
  const onAccent = onColor(accentColor)
  const accentBtnBorder = fillBorder(accentColor)

  const inputStyle = {
    width: '100%',
    background: '#f5f5f7',
    border: '1px solid #d1d1d6',
    borderRadius: '9px',
    padding: '10px 12px',
    // 16px is the threshold below which iOS Safari auto-zooms the page when a
    // field is focused. Keeping inputs at 16px stops that jump while leaving
    // the visitor's own pinch-to-zoom untouched (unlike maximum-scale hacks).
    fontSize: '16px',
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

  const timelines = TIMELINE_VALUES

  return (
    <main style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: '40px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: primaryColor, width: '100%', padding: '22px 20px 16px', textAlign: 'center', position: 'relative' }}>
        <div style={{ fontSize: '20px', fontWeight: '200', color: onPrimary, letterSpacing: '-0.5px' }}>
          oh<span style={{ fontWeight: '700' }}>ACCESS</span>
        </div>
        <div style={{ fontSize: '11px', color: primaryIsLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
          {t.tagline}
        </div>

        {/* Language picker — flag button, top right */}
        <div style={{ position: 'absolute', top: '18px', right: '14px', textAlign: 'left' }}>
          <button
            onClick={() => setLangOpen(o => !o)}
            aria-label="Choose language"
            style={{
              fontSize: '20px',
              lineHeight: 1,
              background: primaryIsLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.14)',
              border: primaryIsLight ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(255,255,255,0.3)',
              borderRadius: '9px',
              padding: '6px 8px',
              cursor: 'pointer'
            }}
          >
            {LANGS.find(l => l.code === lang)?.flag}
          </button>
          {langOpen && (
            <div style={{ position: 'absolute', right: 0, top: '42px', background: 'white', border: '1px solid #d1d1d6', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: '6px', zIndex: 10, minWidth: '160px', maxHeight: '70vh', overflowY: 'auto' }}>
              {LANGS.map(l => (
                <div
                  key={l.code}
                  onClick={() => chooseLang(l.code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#1d1d1f',
                    fontWeight: lang === l.code ? '700' : '400',
                    background: lang === l.code ? '#f5f5f7' : 'transparent'
                  }}
                >
                  <span style={{ fontSize: '17px' }}>{l.flag}</span> {l.label}
                  {lang === l.code && <span style={{ marginLeft: 'auto', fontSize: '12px' }}>✓</span>}
                </div>
              ))}
            </div>
          )}
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
                <label style={labelStyle}>{t.firstName} <span style={{ color: '#ff3b30' }}>*</span></label>
                <input
                  style={{ ...inputStyle, border: errors.name ? '1px solid #ff3b30' : '1px solid #d1d1d6' }}
                  type="text"
                  placeholder={t.firstNamePlaceholder}
                  value={form.firstName}
                  onChange={e => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>{t.lastName} <span style={{ color: '#ff3b30' }}>*</span></label>
                <input
                  style={{ ...inputStyle, border: errors.name ? '1px solid #ff3b30' : '1px solid #d1d1d6' }}
                  type="text"
                  placeholder={t.lastNamePlaceholder}
                  value={form.lastName}
                  onChange={e => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            {errors.name && <div style={{ fontSize: '11px', color: '#ff3b30', marginTop: '4px' }}>{errors.name}</div>}

            {/* Email */}
            <label style={labelStyle}>{t.email} <span style={{ color: '#ff3b30' }}>*</span></label>
            <input
              style={{ ...inputStyle, border: errors.email ? '1px solid #ff3b30' : '1px solid #d1d1d6' }}
              type="email"
              placeholder={t.emailPlaceholder}
              value={form.email}
              onChange={e => {
                setForm({ ...form, email: e.target.value })
                if (errors.email) setErrors({ ...errors, email: null })
              }}
              onBlur={() => {
                if (!validateEmail(form.email) && form.email) {
                  setErrors({ ...errors, email: t.errEmail })
                }
              }}
            />
            {errors.email && <div style={{ fontSize: '11px', color: '#ff3b30', marginTop: '4px' }}>{errors.email}</div>}

            {/* Phone */}
            <label style={labelStyle}>{t.phone} <span style={{ color: '#ff3b30' }}>*</span></label>
            <input
              style={{ ...inputStyle, border: errors.phone ? '1px solid #ff3b30' : '1px solid #d1d1d6' }}
              type="tel"
              placeholder="(000) 000-0000"
              value={form.phone}
              onChange={e => {
                const next = formatPhone(e.target.value)
                setForm({ ...form, phone: next })
                // Flag a bad number the moment a full one is entered; stay quiet
                // while they're still typing.
                const complete = next.replace(/\D/g, '').length >= 10
                setErrors({ ...errors, phone: complete ? phoneErrMsg(next) : null })
              }}
              onBlur={() => {
                if (form.phone) setErrors({ ...errors, phone: phoneErrMsg(form.phone) })
              }}
            />
            {errors.phone && <div style={{ fontSize: '11px', color: '#ff3b30', marginTop: '4px' }}>{errors.phone}</div>}

            {/* Timeline — the submitted value stays the English
                TIMELINE_VALUES entry; only the visible label is translated. */}
            <label style={labelStyle}>{t.timeline} <span style={{ color: '#ff3b30' }}>*</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
              {timelines.map((tv, i) => (
                <div
                  key={tv}
                  onClick={() => { setSelectedTimeline(tv); setErrors({ ...errors, timeline: null }) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    background: selectedTimeline === tv ? '#f0f0f0' : '#f5f5f7',
                    border: selectedTimeline === tv ? `1px solid ${primaryText}` : '1px solid #d1d1d6',
                    borderRadius: '9px',
                    padding: '9px 11px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: selectedTimeline === tv ? primaryText : '#6e6e73',
                    fontWeight: selectedTimeline === tv ? '600' : '400'
                  }}
                >
                  <div style={{
                    width: '13px',
                    height: '13px',
                    borderRadius: '50%',
                    border: selectedTimeline === tv ? `1.5px solid ${primaryText}` : '1.5px solid #d1d1d6',
                    background: selectedTimeline === tv ? primaryColor : 'transparent',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {selectedTimeline === tv && (
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: onPrimary }} />
                    )}
                  </div>
                  {t.timelines[i]}
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
                color: onPrimary,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: '15px',
                fontWeight: '700',
                border: primaryBtnBorder,
                borderRadius: '12px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? t.submitting : t.requestBtn}
            </button>

            {errors.submit && (
              <div style={{ marginTop: '10px', padding: '10px', background: '#fff0f0', borderRadius: '8px', fontSize: '13px', color: '#cc0000' }}>
                {errors.submit}
              </div>
            )}

            {/* TOS */}
            <div style={{ marginTop: '14px', padding: '13px 15px', background: '#f5f5f7', borderRadius: '10px', fontSize: '12px', color: '#48484a', lineHeight: '1.6', textAlign: 'left', border: '1px solid #e5e5ea' }}>
              {t.consentSms.split('{button}')[0]}
              <strong style={{ color: '#1d1d1f' }}>{t.requestBtnName}</strong>
              {t.consentSms.split('{button}')[1]}<br /><br />
              {t.agreePrefix}
              <a href="/terms" style={{ color: '#1d1d1f', fontWeight: '700', textDecoration: 'underline' }}>
                {t.termsLink}
              </a>
              {openHouse.sponsor?.name ? (
                // Sponsored open house: the consent line explicitly names
                // today's sponsor alongside the host agent.
                <>
                  {t.agreeSuffixSponsored.split('{sponsor}')[0]}
                  <strong style={{ color: '#1d1d1f' }}>{openHouse.sponsor.name}</strong>
                  {t.agreeSuffixSponsored.split('{sponsor}')[1]}
                </>
              ) : (
                t.agreeSuffix
              )}
              {t.englishGoverns && <> {t.englishGoverns}</>}
            </div>

            {/* Alternative to acceptance — preserves the validity of consent
                by giving the visitor an obvious, named alternative path. */}
            <div style={{ marginTop: '10px', padding: '13px 15px', background: '#fdfaf3', borderRadius: '10px', fontSize: '12px', color: '#48484a', lineHeight: '1.6', textAlign: 'left', border: '1px solid #ead9ad' }}>
              <strong style={{ color: '#1d1d1f' }}>{t.narTitle}</strong> {t.narBody}
            </div>
          </>
        ) : (
          /* Success screen */
          <div style={{ textAlign: 'center', padding: '16px 18px 22px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: accentColor, border: accentBtnBorder, color: onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: '24px' }}>
              ✓
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f', marginBottom: '6px' }}>
              {t.thankYou}
            </div>
            <div style={{ fontSize: '14px', color: '#6e6e73', background: '#f5f5f7', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px', lineHeight: '1.5' }}>
{t.sentBody1} <br/><br/>{t.sentBody2}
            </div>
            <div style={{ fontSize: '15px', color: '#6e6e73', marginBottom: '10px' }}>
              <strong>{openHouse.property_address}</strong><br />
              <strong>{openHouse.open_house_date} · {openHouse.open_house_hours}</strong>
            </div>
            <div style={{ fontSize: '12px', color: accentText, fontWeight: '600' }}>
                {t.checkPhone}
              </div>
              <div style={{ fontSize: '12px', color: accentText, fontWeight: '600', marginTop: '4px' }}>
                {t.checkEmail}
              </div>
              <div style={{ fontSize: '12px', color: accentText, fontWeight: '600', marginTop: '4px' }}>
                {t.checkAgent}
              </div>

            {/* Post-visit feedback — optional, asked "after your tour". Answers
                are aggregated PII-free into the seller report. */}
            {feedbackToken && (
              <div style={{ marginTop: '14px', paddingTop: '16px', borderTop: '1px solid #e5e5ea', textAlign: 'left' }}>
                {fbDone ? (
                  <div style={{ background: '#e8f9ee', border: '1px solid #b2f0c8', borderRadius: '12px', padding: '14px 16px', fontSize: '13.5px', color: '#1a7a3c', fontWeight: 600, lineHeight: 1.5, textAlign: 'center' }}>
                    {t.feedbackThanks}
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '13.5px', color: '#1d1d1f', lineHeight: 1.5, marginBottom: '12px' }}>
                      <strong>{t.feedbackAfter}</strong>{t.feedbackIntro.split('{after}')[1]}
                    </div>

                    {/* Q1 — overall rating, 1–10 */}
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#1d1d1f', lineHeight: 1.45, marginBottom: '8px' }}>
                      {t.feedbackQ1}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '5px' }}>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                        const on = fbRating === n
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setFbRating(n)}
                            style={{ aspectRatio: '1', minWidth: 0, borderRadius: '9px', border: on ? accentBtnBorder : '1px solid #d1d1d6', background: on ? accentColor : '#f5f5f7', color: on ? onAccent : '#1d1d1f', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: 0 }}
                          >
                            {n}
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8e8e93', marginTop: '5px' }}>
                      <span>1 · {t.feedbackScaleLow}</span>
                      <span>{t.feedbackScaleHigh} · 10</span>
                    </div>

                    {/* Q2 — price sentiment */}
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#1d1d1f', lineHeight: 1.45, margin: '14px 0 8px' }}>
                      {t.feedbackQ2}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {t.feedbackPrices.map((lbl, i) => {
                        const on = fbPriceIdx === i
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setFbPriceIdx(i)}
                            style={{ borderRadius: '9px', border: on ? accentBtnBorder : '1px solid #d1d1d6', background: on ? accentColor : '#f5f5f7', color: on ? onAccent : '#1d1d1f', fontSize: '13px', fontWeight: 700, padding: '11px 6px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                          >
                            {lbl}
                          </button>
                        )
                      })}
                    </div>

                    {fbError && (
                      <div style={{ marginTop: '12px', fontSize: '12.5px', color: '#cc0000', fontWeight: 600 }}>
                        {t.feedbackError}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={submitFeedback}
                      disabled={fbSubmitting || fbRating === null || fbPriceIdx === null}
                      style={{ marginTop: '14px', width: '100%', background: (fbRating !== null && fbPriceIdx !== null) ? primaryColor : '#e8e8ed', color: (fbRating !== null && fbPriceIdx !== null) ? onPrimary : '#aeaeb2', border: (fbRating !== null && fbPriceIdx !== null) ? primaryBtnBorder : 'none', borderRadius: '12px', padding: '13px', fontSize: '15px', fontWeight: 700, cursor: (fbSubmitting || fbRating === null || fbPriceIdx === null) ? 'default' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: fbSubmitting ? 0.7 : 1 }}
                    >
                      {fbSubmitting ? t.feedbackSubmitting : t.feedbackSubmit}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}