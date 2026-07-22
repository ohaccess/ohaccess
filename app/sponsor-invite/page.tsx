'use client'
import { useState, useEffect, Suspense } from 'react'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

// An agent lands here from a sponsor's invitation email. Accepting is the
// agent's explicit, on-record approval: from then on the sponsor's card
// appears below theirs in visitor emails and the sign-in consent names the
// sponsor. Mirrors /accept-invite (team invites).

type InviteState =
  | { status: 'loading' }
  | { status: 'invalid'; reason: string }
  | { status: 'valid'; email: string; sponsorName: string }

function reasonMessage(reason: string): string {
  if (reason === 'expired') return 'This invitation has expired. Ask your sponsor to send a new one.'
  if (reason === 'used') return 'This invitation has already been used.'
  return 'This invitation link is invalid. Ask your sponsor to send a new one.'
}

function SponsorInviteForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const justConfirmed = searchParams.get('confirmed') === 'true'

  const [invite, setInvite] = useState<InviteState>({ status: 'loading' })
  const [mode, setMode] = useState<'signin' | 'create'>('signin')
  const [password, setPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkEmail, setCheckEmail] = useState(false)
  const [accepted, setAccepted] = useState(false)

  // Look up the invite, then auto-finalize if the user is already signed in
  // with the matching email.
  useEffect(() => {
    if (!token) { setInvite({ status: 'invalid', reason: 'missing' }); return }
    let cancelled = false
    ;(async () => {
      const res = await fetch(`/api/sponsor/accept?token=${encodeURIComponent(token)}`)
      const json = await res.json()
      if (cancelled) return
      if (!json.valid) {
        setInvite({ status: 'invalid', reason: json.reason || 'invalid' })
        return
      }
      setInvite({ status: 'valid', email: json.email, sponsorName: json.sponsorName })
      if (justConfirmed) setMode('signin')
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const finalize = async (accessToken: string) => {
    const res = await fetch('/api/sponsor/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ token }),
    })
    const json = await res.json()
    if (res.ok && json.success) {
      setAccepted(true)
      return
    }
    setError(json.error || 'Could not accept the sponsorship.')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (invite.status !== 'valid') return
    setError('')

    if (mode === 'create' && !agreedToTerms) {
      setError('Please agree to the Subscriber Terms of Service and Privacy Policy to continue.')
      return
    }
    setLoading(true)

    if (mode === 'signin') {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password,
      })
      if (signInErr) {
        setError(signInErr.message)
      } else if (data.user && !data.user.email_confirmed_at) {
        setError('Please confirm your email first. Check your inbox for the confirmation link.')
        await supabase.auth.signOut()
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) { await finalize(session.access_token); setLoading(false); return }
      }
      setLoading(false)
      return
    }

    // Create account — preserve the token through the email-confirmation hop.
    const confirmUrl = new URL('https://ohaccess.com/sponsor-invite')
    confirmUrl.searchParams.set('token', token)
    confirmUrl.searchParams.set('confirmed', 'true')

    const { error: signUpErr } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { emailRedirectTo: confirmUrl.toString() },
    })
    if (signUpErr) {
      setError(signUpErr.message)
    } else {
      try {
        await fetch('/api/legal/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: invite.email }),
        })
      } catch {}
      setCheckEmail(true)
    }
    setLoading(false)
  }

  const card = (children: React.ReactNode) => (
    <main style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '24px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ background: 'white', borderRadius: '22px', border: '1px solid #d1d1d6', padding: '40px', width: '100%', maxWidth: '420px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: '28px', fontWeight: '200', color: '#1d1d1f', letterSpacing: '-0.5px' }}>
              oh<span style={{ fontWeight: '700' }}>ACCESS</span>
            </div>
          </Link>
        </div>
        {children}
      </div>
    </main>
  )

  if (invite.status === 'loading') {
    return card(<div style={{ textAlign: 'center', color: '#6e6e73', fontSize: '14px' }}>Loading invitation…</div>)
  }

  if (invite.status === 'invalid') {
    return card(
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
        <div style={{ fontSize: '18px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>Invitation problem</div>
        <p style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.6', marginBottom: '20px' }}>{reasonMessage(invite.reason)}</p>
        <Link href="/login" style={{ color: '#0071e3', fontSize: '14px', textDecoration: 'none', fontWeight: '600' }}>Go to sign in →</Link>
      </div>
    )
  }

  if (accepted) {
    return card(
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#1d1d1f', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px', color: 'white' }}>✓</div>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>Sponsorship active!</div>
        <p style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.6', marginBottom: '20px' }}>
          <strong>{invite.sponsorName}</strong> now appears below your card in the emails your
          open-house visitors receive. You can end the sponsorship anytime from your Settings tab.
        </p>
        <a href="/dashboard" style={{ display: 'inline-block', background: '#1d1d1f', color: 'white', padding: '12px 28px', borderRadius: '10px', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
          Go to my dashboard →
        </a>
      </div>
    )
  }

  if (checkEmail) {
    return card(
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>Check your email!</div>
        <p style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.6' }}>
          We sent a confirmation link to <strong>{invite.email}</strong>.<br /><br />
          Click it to activate your account, then you&apos;ll be able to accept the sponsorship from <strong>{invite.sponsorName}</strong>.
        </p>
      </div>
    )
  }

  const inputStyle = { width: '100%', background: '#f5f5f7', border: '1px solid #d1d1d6', borderRadius: '9px', padding: '10px 12px', fontSize: '14px', color: '#1d1d1f', outline: 'none', boxSizing: 'border-box' as const, fontFamily: "'Plus Jakarta Sans', sans-serif" }

  return card(
    <>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f', marginBottom: '6px' }}>
          {invite.sponsorName} wants to sponsor your account
        </div>
        <p style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.5' }}>
          {mode === 'signin' ? 'Sign in to review and accept.' : 'Create your ohACCESS account to review and accept.'}
        </p>
      </div>

      {/* What accepting means — shown BEFORE the agent clicks accept. */}
      <div style={{ background: '#fdf4e3', border: '1px solid #ead9ad', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px', fontSize: '12px', color: '#48484a', lineHeight: '1.6' }}>
        If you accept: your sponsor&apos;s card (photo, contact info, and logo) appears <strong>below yours</strong> in
        visitor emails, and your sign-in form&apos;s consent language names them alongside you.
        You can end the sponsorship anytime from Settings.
      </div>

      {justConfirmed && mode === 'signin' && (
        <div style={{ background: '#e8f9ee', border: '1px solid #b2f0c8', borderRadius: '10px', padding: '10px 14px', marginBottom: '18px', fontSize: '13px', color: '#1a7a3c', textAlign: 'center', fontWeight: '600' }}>
          ✅ Email confirmed! Sign in to accept.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>Email Address</label>
          <input type="email" value={invite.email} readOnly disabled style={{ ...inputStyle, color: '#6e6e73', cursor: 'not-allowed' }} />
        </div>
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'create' ? 'Create a password (min 8 characters)' : 'Your password'}
            required
            minLength={8}
            style={inputStyle}
          />
        </div>

        {mode === 'create' && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px', fontSize: '12px', color: '#6e6e73', lineHeight: '1.5', cursor: 'pointer' }}>
            <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} style={{ marginTop: '2px', cursor: 'pointer', flexShrink: 0 }} />
            <span>
              I agree to the <a href="/subscriber-terms" target="_blank" rel="noopener noreferrer" style={{ color: '#0071e3', textDecoration: 'underline' }}>Subscriber Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#0071e3', textDecoration: 'underline' }}>Privacy Policy</a>.
            </span>
          </label>
        )}

        {error && (
          <div style={{ background: '#fff0f0', color: '#cc0000', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', lineHeight: '1.5' }}>{error}</div>
        )}

        <button type="submit" disabled={loading} style={{ width: '100%', background: '#1d1d1f', color: 'white', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in & accept →' : 'Create account & accept →'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#6e6e73' }}>
        {mode === 'signin' ? (
          <>New to ohACCESS? <button onClick={() => { setMode('create'); setError('') }} style={{ background: 'none', border: 'none', color: '#0071e3', fontSize: '13px', cursor: 'pointer', fontWeight: '600', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Create an account</button></>
        ) : (
          <>Already have an account? <button onClick={() => { setMode('signin'); setError('') }} style={{ background: 'none', border: 'none', color: '#0071e3', fontSize: '13px', cursor: 'pointer', fontWeight: '600', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Sign in</button></>
        )}
      </div>
    </>
  )
}

export default function SponsorInvitePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#f5f5f7', fontSize: '16px', color: '#6e6e73' }}>Loading…</div>}>
      <SponsorInviteForm />
    </Suspense>
  )
}
