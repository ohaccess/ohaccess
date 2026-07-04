'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function Contact() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    brokerage: '',
    agentCount: '',
    message: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      setSubmitted(true)
    } catch {
      alert('Something went wrong. Please email us directly at sales@ohaccess.com')
    } finally {
      setLoading(false)
    }
  }

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').substring(0, 10)
    if (digits.length === 0) return ''
    if (digits.length <= 3) return `(${digits}`
    if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  }

  const inputStyle = {
    width: '100%', background: '#f5f5f7', border: '1px solid #d1d1d6',
    borderRadius: '9px', padding: '10px 12px', fontSize: '14px',
    color: '#1d1d1f', outline: 'none', boxSizing: 'border-box' as const,
    fontFamily: "'Plus Jakarta Sans', sans-serif"
  }

  const labelStyle = {
    display: 'block' as const, fontSize: '11px', fontWeight: '600' as const,
    color: '#6e6e73', textTransform: 'uppercase' as const,
    letterSpacing: '0.6px', marginBottom: '5px'
  }

  return (
    <main style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#ffffff', color: '#1d1d1f', minHeight: '100vh' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />

      <style>{`
        * { box-sizing: border-box; }
        .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
        @media (max-width: 768px) {
          .contact-grid { grid-template-columns: 1fr; gap: 32px; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ background: '#1d1d1f', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: '22px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px' }}>
            oh<span style={{ fontWeight: '700' }}>ACCESS</span>
          </div>
        </Link>
        <Link href="/login" style={{ background: '#c9963a', color: '#1d1d1f', padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
          Agent login
        </Link>
      </nav>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(201,150,58,0.1)', border: '1px solid rgba(201,150,58,0.3)', borderRadius: '20px', padding: '6px 16px', fontSize: '13px', color: '#c9963a', fontWeight: '600', marginBottom: '16px' }}>
            Enterprise & Brokerage
          </div>
          <h1 style={{ fontSize: '36px', fontWeight: '700', color: '#1d1d1f', letterSpacing: '-1px', marginBottom: '12px' }}>
            Let&apos;s talk about your brokerage
          </h1>
          <p style={{ fontSize: '16px', color: '#6e6e73', maxWidth: '560px', margin: '0 auto', lineHeight: '1.6' }}>
            ohACCESS offers custom pricing for brokerages of all sizes. Tell us about your team and we&apos;ll put together a plan that works for you.
          </p>
        </div>

        <div className="contact-grid">

          {/* Left — why ohACCESS */}
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1d1d1f', marginBottom: '24px' }}>
              Why brokerages choose ohACCESS
            </div>

            {[
              { emoji: '🏢', title: 'Built for teams', body: 'Manage all your agents from one admin dashboard. See every open house and visitor log across your entire brokerage.' },
              { emoji: '🎨', title: 'Brokerage branding', body: 'Your logo on every visitor email, plus your team colors carried across every agent\'s registration page.' },
              { emoji: '💰', title: 'Per-agent pricing', body: 'Pay only for the agents you have. Pricing scales with your team — from boutique brokerages to enterprise networks.' },
              { emoji: '📋', title: 'CRM integration', body: 'Every sign-in flows automatically into your agents\' CRMs — Follow Up Boss, BoldTrail, Lofty, Sierra, Real Geeks, and more (or any app via Zapier) — plus one-click CSV export and brokerage-wide reporting.' },
              { emoji: '🔒', title: 'Compliance ready', body: 'Built-in TCPA consent, DNC override language, and data sharing terms protect your brokerage from day one.' },
              { emoji: '🚀', title: 'Fast onboarding', body: 'Your entire team can be set up and running at their first open house within 24 hours of signing up.' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', gap: '14px', marginBottom: '20px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '22px', flexShrink: 0, marginTop: '2px' }}>{item.emoji}</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1d1d1f', marginBottom: '3px' }}>{item.title}</div>
                  <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.6' }}>{item.body}</div>
                </div>
              </div>
            ))}

            {/* Pricing tiers */}
            <div style={{ background: '#f5f5f7', borderRadius: '16px', padding: '20px', marginTop: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1d1d1f', marginBottom: '12px' }}>Enterprise pricing guide:<br/>(Discounts for long-term contracts.)</div>
              {[
                { range: '11–100 agents', price: '$11/agent/mo', note: 'Contact us' },
                { range: '101–500 agents', price: '$10/agent/mo', note: 'Contact us' },
                { range: '501–1,000 agents', price: '$9/agent/mo', note: 'Contact us' },
                { range: '1,001–5,000 agents', price: '$8/agent/mo', note: 'Contact us' },
                { range: '5,001-10K agents', price: '$7/agent/mo', note: 'Contact us' },
                { range: '10K or more agents', price: 'Custom', note: 'Contact us' },
                
              ].map((row, i) => (
                <div key={row.range} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 5 ? '1px solid #e5e5ea' : 'none', fontSize: '13px', gap: '8px' }}>
                  <span style={{ color: '#1d1d1f', fontWeight: '500', flex: 1 }}>{row.range}</span>
                  <span style={{ color: '#c9963a', fontWeight: '700', flexShrink: 0 }}>{row.price}</span>
                  <span style={{ color: '#6e6e73', fontSize: '11px', flexShrink: 0 }}>{row.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — contact form */}
          <div>
            {!submitted ? (
              <div style={{ background: 'white', borderRadius: '22px', border: '1px solid #d1d1d6', padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#1d1d1f', marginBottom: '4px' }}>Get in touch</div>
                <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '24px' }}>We typically respond within one business day.</div>

                <form onSubmit={handleSubmit}>
                  {[
                    { label: 'Your Name', key: 'name', type: 'text', placeholder: 'David Ryan', required: true },
                    { label: 'Work Email', key: 'email', type: 'email', placeholder: 'david@brokerage.com', required: true },
                    { label: 'Brokerage Name', key: 'brokerage', type: 'text', placeholder: 'Premier Realty Group', required: true },
                  ].map(field => (
                    <div key={field.key} style={{ marginBottom: '14px' }}>
                      <label style={labelStyle}>
                        {field.label} <span style={{ color: '#ff3b30' }}>*</span>
                      </label>
                      <input
                        type={field.type}
                        required={field.required}
                        placeholder={field.placeholder}
                        value={form[field.key as keyof typeof form]}
                        onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  ))}

                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Phone Number</label>
                    <input
                      type="tel"
                      placeholder="(214) 555-0182"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: formatPhone(e.target.value) })}
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>
                      Number of Agents <span style={{ color: '#ff3b30' }}>*</span>
                    </label>
                    <select
                      required
                      value={form.agentCount}
                      onChange={e => setForm({ ...form, agentCount: e.target.value })}
                      style={{ ...inputStyle, color: form.agentCount ? '#1d1d1f' : '#aeaeb2' }}
                    >
                      <option value="">Select agent count</option>
                      <option value="11-100">11–100 agents ($11/agent/mo)</option>
                      <option value="101-500">101–500 agents ($10/agent/mo)</option>
                      <option value="501-1000">501–1,000 agents ($9/agent/mo)</option>
                      <option value="1001-5000">1,001–5,000 agents ($8/agent/mo)</option>
                      <option value="5001-10K">5,001-10K agents ($7/agent/mo)</option>
                      <option value="10K+">10K or more agents (Custom)</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={labelStyle}>Message</label>
                    <textarea
                      placeholder="Tell us about your brokerage and what you're looking for..."
                      value={form.message}
                      onChange={e => setForm({ ...form, message: e.target.value })}
                      rows={4}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{ width: '100%', background: '#1d1d1f', color: 'white', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: loading ? 0.7 : 1 }}
                  >
                    {loading ? 'Sending...' : 'Send message →'}
                  </button>

                  <div style={{ marginTop: '16px', fontSize: '12px', color: '#6e6e73', textAlign: 'center' }}>
                    Or email us directly at{' '}
                   <a href="mailto:sales@ohaccess.com" style={{ color: '#1d1d1f', fontWeight: '600' }}>
                      sales@ohaccess.com
                    </a>
                  </div>
                </form>
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: '22px', border: '1px solid #d1d1d6', padding: '48px 32px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>Message received!</div>
                <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.6', marginBottom: '24px' }}>
                  Thanks for reaching out. We&apos;ll be in touch within one business day to discuss your brokerage needs.
                </div>
                <Link href="/" style={{ background: '#1d1d1f', color: 'white', padding: '12px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
                  Back to ohaccess.com
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ background: '#111', padding: '40px 24px', textAlign: 'center', marginTop: '60px' }}>
        <div style={{ fontSize: '20px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px', marginBottom: '16px' }}>
          oh<span style={{ fontWeight: '700' }}>ACCESS</span>
        </div>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
          <a href="/terms" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Visitor Terms</a>
          <a href="/subscriber-terms" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Subscriber Terms</a>
          <a href="/privacy" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/partners" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Partners</a>
          <a href="/contact" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Contact</a>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>© 2026 ohACCESS. All rights reserved. · <span style={{ fontWeight: '600' }}>Patent Pending</span></div>
      </footer>
    </main>
  )
}