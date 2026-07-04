'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function Partners() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    brokerage: '',        // company name
    businessType: '',
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
        .partner-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
        @media (max-width: 768px) {
          .partner-grid { grid-template-columns: 1fr; gap: 32px; }
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
            Partner Program
          </div>
          <h1 style={{ fontSize: '36px', fontWeight: '700', color: '#1d1d1f', letterSpacing: '-1px', marginBottom: '12px' }}>
            Put your brand on every open house
          </h1>
          <p style={{ fontSize: '16px', color: '#6e6e73', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
            For mortgage lenders, title companies, inspectors, insurance agents, and other real estate partners: sponsor ohACCESS for your agent partners, put your branding on every verified open-house sign-in, and see the leads it captures — all from one dashboard.
          </p>
        </div>

        <div className="partner-grid">

          {/* Left — why partner */}
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1d1d1f', marginBottom: '24px' }}>
              Why partner with ohACCESS
            </div>

            {[
              { emoji: '🎨', title: 'Your brand on every sign-in', body: 'Your logo and colors appear on every verified visitor email your agents send — you control all of it from your Team dashboard.' },
              { emoji: '🤝', title: 'Sponsor your agent partners', body: 'Pay for one Team plan and share ohACCESS with up to 10 of your agent partners. You own the account; they run their open houses.' },
              { emoji: '📊', title: 'Leads delivered to your CRM', body: 'Set one Team CRM lead email and every verified sign-in from your agents’ open houses is forwarded straight into your CRM — automatically, no exports. Plus a shared dashboard and CSV export whenever you want it. Real buyers and sellers, captured at the door.' },
              { emoji: '🔁', title: 'Stay top of mind', body: 'Show up in front of motivated buyers and sellers at the exact moment they’re touring homes — and strengthen your agent relationships.' },
              { emoji: '🛡️', title: 'Built for RESPA-conscious co-marketing', body: 'You pay for the platform and control your own branding while your agents run their events. As with any co-marketing arrangement, confirm your specific setup with your own compliance counsel.' },
              { emoji: '🚀', title: 'Live within 24 hours', body: 'Set up your team, add your branding, and be running at your agents’ first open house within a day of signing up.' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', gap: '14px', marginBottom: '20px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '22px', flexShrink: 0, marginTop: '2px' }}>{item.emoji}</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1d1d1f', marginBottom: '3px' }}>{item.title}</div>
                  <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.6' }}>{item.body}</div>
                </div>
              </div>
            ))}

            {/* How it works */}
            <div style={{ background: '#f5f5f7', borderRadius: '16px', padding: '20px', marginTop: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1d1d1f', marginBottom: '14px' }}>How it works</div>
              {[
                { n: '1', t: 'Subscribe to a Team plan', d: '$120/mo, $1,200 annually, or $1,920 for two years when paid upfront — up to 10 agent partners. Add your logo and brand colors.' },
                { n: '2', t: 'Invite your agent partners', d: 'They join your team and start running verified open houses.' },
                { n: '3', t: 'Your brand + your leads', d: 'Every sign-in goes out under your branding and lands in your dashboard.' },
              ].map((s, i) => (
                <div key={s.n} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', paddingBottom: i < 2 ? '12px' : '0', marginBottom: i < 2 ? '12px' : '0', borderBottom: i < 2 ? '1px solid #e5e5ea' : 'none' }}>
                  <div style={{ width: '24px', height: '24px', background: '#1d1d1f', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: 'white', flexShrink: 0 }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#1d1d1f' }}>{s.t}</div>
                    <div style={{ fontSize: '12px', color: '#6e6e73', lineHeight: '1.5', marginTop: '2px' }}>{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — contact form */}
          <div>
            {!submitted ? (
              <div style={{ background: 'white', borderRadius: '22px', border: '1px solid #d1d1d6', padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#1d1d1f', marginBottom: '4px' }}>Become a partner</div>
                <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '24px' }}>Tell us about your business and we&apos;ll get you set up. We typically respond within one business day.</div>

                <form onSubmit={handleSubmit}>
                  {[
                    { label: 'Your Name', key: 'name', type: 'text', placeholder: 'David Ryan', required: true },
                    { label: 'Work Email', key: 'email', type: 'email', placeholder: 'david@company.com', required: true },
                    { label: 'Company Name', key: 'brokerage', type: 'text', placeholder: 'Summit Mortgage', required: true },
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
                    <label style={labelStyle}>
                      Business Type <span style={{ color: '#ff3b30' }}>*</span>
                    </label>
                    <select
                      required
                      value={form.businessType}
                      onChange={e => setForm({ ...form, businessType: e.target.value })}
                      style={{ ...inputStyle, color: form.businessType ? '#1d1d1f' : '#aeaeb2' }}
                    >
                      <option value="">Select your business type</option>
                      <option value="Mortgage Lender">Mortgage Lender</option>
                      <option value="Title Company">Title Company</option>
                      <option value="Home Inspector">Home Inspector</option>
                      <option value="Insurance Agent">Insurance Agent</option>
                      <option value="Roofer / Contractor">Roofer / Contractor</option>
                      <option value="Real Estate Attorney">Real Estate Attorney</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

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
                    <label style={labelStyle}>How many agent partners?</label>
                    <select
                      value={form.agentCount}
                      onChange={e => setForm({ ...form, agentCount: e.target.value })}
                      style={{ ...inputStyle, color: form.agentCount ? '#1d1d1f' : '#aeaeb2' }}
                    >
                      <option value="">Select a range</option>
                      <option value="1-10">1–10 (one Team plan)</option>
                      <option value="11-25">11–25</option>
                      <option value="26-50">26–50</option>
                      <option value="50+">50+</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>Message</label>
                    <textarea
                      placeholder="Tell us about your business and your agent partners..."
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
                    {loading ? 'Sending...' : 'Get started →'}
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
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤝</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>Thanks — we&apos;ll be in touch!</div>
                <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.6', marginBottom: '24px' }}>
                  We&apos;ll reach out within one business day to get your partner team set up.
                </div>
                <Link href="/" style={{ background: '#1d1d1f', color: 'white', padding: '12px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
                  Back to ohaccess.com
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Compliance note */}
        <div style={{ maxWidth: '760px', margin: '40px auto 0', background: '#f5f5f7', borderRadius: '14px', padding: '18px 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>A note on compliance</div>
          <div style={{ fontSize: '12px', color: '#6e6e73', lineHeight: '1.7' }}>
            ohACCESS provides co-marketing and lead-capture tools; it does not provide legal advice. You are responsible for ensuring your co-marketing arrangement complies with RESPA and all applicable federal and state law. Please consult your own compliance counsel before entering into any arrangement with your agent partners.
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
