'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

// PUBLIC gift purchase page — "Know a real estate agent? Give them a year of
// ohACCESS Pro." The giver needs no account: this form feeds
// /api/gift/checkout, Stripe collects payment, and the webhook emails the
// claim link + gift code. One product only, one-time payment, never renews.

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#f5f5f7',
  border: '1px solid #d1d1d6',
  borderRadius: '10px',
  padding: '12px 14px',
  fontSize: '14px',
  color: '#1d1d1f',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#6e6e73',
  marginBottom: '6px',
}

function GiftForm() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')

  const [giverName, setGiverName] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const startCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/gift/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giverName, recipientName, recipientEmail, note }),
      })
      const json = await res.json()
      if (res.ok && json.url) {
        window.location.href = json.url
        return
      }
      setError(json.error || 'Could not start checkout — please try again.')
    } catch {
      setError('Could not start checkout — please try again.')
    }
    setLoading(false)
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '24px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ background: 'white', borderRadius: '22px', border: '1px solid #d1d1d6', padding: '40px', width: '100%', maxWidth: '460px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: '28px', fontWeight: 200, color: '#1d1d1f', letterSpacing: '-0.5px' }}>
              oh<span style={{ fontWeight: 700 }}>ACCESS</span>
            </div>
          </Link>
        </div>

        {status === 'success' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎁</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1d1d1f', marginBottom: '8px' }}>
              Your gift is on its way!
            </div>
            <p style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.6', marginBottom: '8px' }}>
              Check your email — we&apos;ve sent you the claim link and gift code. If you added your agent&apos;s
              email, their gift-wrapped copy is already in their inbox too.
            </p>
            <p style={{ fontSize: '12px', color: '#aeaeb2', marginBottom: '24px' }}>
              Don&apos;t see it? Check your spam folder, or email support@ohaccess.com.
            </p>
            <Link href="/" style={{ display: 'inline-block', background: '#1d1d1f', color: 'white', padding: '12px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
              Back to ohACCESS
            </Link>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎁</div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.5px', margin: '0 0 8px' }}>
                Give a year of ohACCESS Pro
              </h1>
              <p style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.6', margin: 0 }}>
                Know a real estate agent? Give them 12 months of verified open-house sign-ins —
                unlimited registrations, instant lead alerts, the works.
              </p>
              <div style={{ marginTop: '14px', fontSize: '30px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-1px' }}>
                $150
                <span style={{ fontSize: '13px', fontWeight: 400, color: '#6e6e73' }}> one-time — never auto-renews</span>
              </div>
            </div>

            {status === 'cancel' && (
              <div style={{ background: '#fff8e6', border: '1px solid #f0dfae', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#8a6d1a', textAlign: 'center' }}>
                Checkout canceled — no charge was made. Pick up where you left off below.
              </div>
            )}

            <form onSubmit={startCheckout}>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Your name</label>
                <input style={inputStyle} type="text" placeholder="Margaret Sheehan" value={giverName} onChange={(e) => setGiverName(e.target.value)} maxLength={80} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Agent&apos;s name <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input style={inputStyle} type="text" placeholder="Sarah Connelly" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} maxLength={80} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Agent&apos;s email <span style={{ fontWeight: 400 }}>(optional — we&apos;ll email them the gift; leave blank to deliver it yourself)</span></label>
                <input style={inputStyle} type="email" placeholder="sarah@example.com" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} maxLength={200} />
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Gift note <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} placeholder="Congrats on getting your license — go get 'em!" value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} />
              </div>

              {error && (
                <div style={{ background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#cc0000' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', background: '#c9963a', color: '#1d1d1f', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: loading ? 0.6 : 1 }}
              >
                {loading ? 'Opening checkout…' : 'Continue to payment →'}
              </button>
            </form>

            <p style={{ fontSize: '12px', color: '#aeaeb2', lineHeight: '1.6', textAlign: 'center', marginTop: '16px', marginBottom: 0 }}>
              After payment you&apos;ll get a claim link and gift code by email — forward it, text it, or tuck it in
              a card. If they already subscribe, the gift adds 12 months on top.
            </p>
            <p style={{ fontSize: '12px', color: '#aeaeb2', textAlign: 'center', marginTop: '10px', marginBottom: 0 }}>
              Received a gift? <Link href="/gift/claim" style={{ color: '#0071e3' }}>Claim your code here</Link>.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

export default function GiftPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#f5f5f7', fontSize: '16px', color: '#6e6e73' }}>Loading...</div>}>
      <GiftForm />
    </Suspense>
  )
}
