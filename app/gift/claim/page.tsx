'use client'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'

// Gift claim page — the destination of every claim link and where a typed
// gift code gets redeemed. Signed-out visitors are routed through /login
// (sign in or create the free account) with ?next= carrying them straight
// back here, code intact; signed-in agents claim in one tap.

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#f5f5f7',
  border: '1px solid #d1d1d6',
  borderRadius: '10px',
  padding: '12px 14px',
  fontSize: '16px',
  color: '#1d1d1f',
  fontFamily: 'monospace',
  letterSpacing: '1px',
  textAlign: 'center',
  textTransform: 'uppercase',
  boxSizing: 'border-box',
}

function ClaimForm() {
  const searchParams = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code') || '')
  const [signedIn, setSignedIn] = useState<boolean | null>(null) // null = still checking
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [claimed, setClaimed] = useState<{ accessUntil?: string; giverName?: string; note?: string; alreadyClaimed?: boolean } | null>(null)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => setSignedIn(!!session?.user?.email_confirmed_at))
      .catch(() => setSignedIn(false))
  }, [])

  const claim = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setSignedIn(false)
        setLoading(false)
        return
      }
      const res = await fetch('/api/gift/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setClaimed(json)
      } else {
        setError(json.error || 'Could not claim this gift — please try again.')
      }
    } catch {
      setError('Could not claim this gift — please try again.')
    }
    setLoading(false)
  }

  // Send signed-out visitors through login/signup and straight back here.
  const nextPath = `/gift/claim${code ? `?code=${encodeURIComponent(code)}` : ''}`
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`
  const signupHref = `/login?signup=true&next=${encodeURIComponent(nextPath)}`

  const formatDate = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : null

  return (
    <main style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '24px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ background: 'white', borderRadius: '22px', border: '1px solid #d1d1d6', padding: '40px', width: '100%', maxWidth: '440px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: '28px', fontWeight: 200, color: '#1d1d1f', letterSpacing: '-0.5px' }}>
              oh<span style={{ fontWeight: 700 }}>ACCESS</span>
            </div>
          </Link>
        </div>

        {claimed ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1d1d1f', marginBottom: '8px' }}>
              {claimed.alreadyClaimed ? 'This gift is already on your account!' : "You've got Pro!"}
            </div>
            {claimed.giverName && (
              <p style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.6', marginBottom: '8px' }}>
                A year of ohACCESS Pro, from <strong>{claimed.giverName}</strong>.
              </p>
            )}
            {claimed.note && (
              <div style={{ background: '#f5f5f7', borderRadius: '10px', padding: '14px 16px', margin: '16px 0', fontSize: '14px', color: '#1d1d1f', fontStyle: 'italic' }}>
                &ldquo;{claimed.note}&rdquo;
              </div>
            )}
            {formatDate(claimed.accessUntil) && (
              <p style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.6', marginBottom: '24px' }}>
                Your Pro access runs through <strong>{formatDate(claimed.accessUntil)}</strong>.
              </p>
            )}
            <Link href="/dashboard" style={{ display: 'inline-block', background: '#c9963a', color: '#1d1d1f', padding: '12px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
              Go to my dashboard →
            </Link>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎁</div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.5px', margin: '0 0 8px' }}>
                Claim your gift
              </h1>
              <p style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.6', margin: 0 }}>
                Someone gave you a year of ohACCESS Pro — verified open-house sign-ins with unlimited
                registrations and instant lead alerts.
              </p>
            </div>

            <form onSubmit={claim}>
              <div style={{ marginBottom: '16px' }}>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="GIFT-XXXX-XXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={20}
                  autoComplete="off"
                />
              </div>

              {error && (
                <div style={{ background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#cc0000' }}>
                  {error}
                </div>
              )}

              {signedIn ? (
                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  style={{ width: '100%', background: '#c9963a', color: '#1d1d1f', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: loading || !code.trim() ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: loading || !code.trim() ? 0.6 : 1 }}
                >
                  {loading ? 'Applying…' : 'Apply to my account 🎉'}
                </button>
              ) : signedIn === false ? (
                <div>
                  <p style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.6', textAlign: 'center', marginTop: 0, marginBottom: '14px' }}>
                    Sign in — or create your free account — and we&apos;ll bring you right back here to apply it.
                  </p>
                  <Link href={loginHref} style={{ display: 'block', textAlign: 'center', background: '#1d1d1f', color: 'white', padding: '13px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', marginBottom: '10px' }}>
                    Sign in to claim
                  </Link>
                  <Link href={signupHref} style={{ display: 'block', textAlign: 'center', background: '#f5f5f7', color: '#1d1d1f', border: '1px solid #d1d1d6', padding: '13px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
                    New here? Create your free account
                  </Link>
                </div>
              ) : (
                <div style={{ textAlign: 'center', fontSize: '13px', color: '#aeaeb2', padding: '12px 0' }}>
                  Checking your session…
                </div>
              )}
            </form>

            <p style={{ fontSize: '12px', color: '#aeaeb2', lineHeight: '1.6', textAlign: 'center', marginTop: '16px', marginBottom: 0 }}>
              Already subscribed? The gift adds 12 months on top of your current plan. Trouble claiming?
              Email support@ohaccess.com with your code.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

export default function GiftClaimPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#f5f5f7', fontSize: '16px', color: '#6e6e73' }}>Loading...</div>}>
      <ClaimForm />
    </Suspense>
  )
}
