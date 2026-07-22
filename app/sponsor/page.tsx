'use client'
import { useState, useEffect } from 'react'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import Link from 'next/link'

// Sign-in / sign-up for SPONSORS — 3rd-party providers (lenders, title,
// insurance…) who co-brand agents' open houses. Mirrors /login but lands on
// /sponsor/dashboard instead of the agent dashboard.
export default function SponsorLoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // Already signed in? Straight to the sponsor dashboard.
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user?.email_confirmed_at) window.location.href = '/sponsor/dashboard'
      })
      .catch(async () => { try { await supabase.auth.signOut() } catch {} })
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!isLogin && !agreedToTerms) {
      setError('Please agree to the Subscriber Terms of Service and Privacy Policy to continue.')
      return
    }

    setLoading(true)

    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else if (data.user && !data.user.email_confirmed_at) {
        setError('Please confirm your email address before signing in. Check your inbox for the confirmation link.')
        await supabase.auth.signOut()
      } else {
        window.location.href = '/sponsor/dashboard'
        return
      }
    } else {
      // Send the post-confirmation sign-in back to the sponsor dashboard
      // (the login page honors ?next= after the confirmation roundtrip).
      const confirmUrl = new URL('https://ohaccess.com/login')
      confirmUrl.searchParams.set('confirmed', 'true')
      confirmUrl.searchParams.set('next', '/sponsor/dashboard')

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: confirmUrl.toString() },
      })
      if (error) {
        setError(error.message)
      } else {
        // Record the click-through acceptance for the legal audit trail.
        try {
          await fetch('/api/legal/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
        } catch {}
        setMessage('confirmed')
      }
    }
    setLoading(false)
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#f5f5f7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      padding: '24px'
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{
        background: 'white',
        borderRadius: '22px',
        border: '1px solid #d1d1d6',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: '28px', fontWeight: '200', color: '#1d1d1f', letterSpacing: '-0.5px' }}>
              oh<span style={{ fontWeight: '700' }}>ACCESS</span>
            </div>
          </Link>
          <div style={{ display: 'inline-block', marginTop: '8px', background: '#fdf4e3', border: '1px solid #ead9ad', color: '#8a6a1f', fontSize: '11px', fontWeight: '700', letterSpacing: '0.6px', textTransform: 'uppercase', borderRadius: '999px', padding: '4px 12px' }}>
            Sponsor Portal
          </div>
        </div>

        {message === 'confirmed' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>
              Check your email!
            </div>
            <p style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.6', marginBottom: '24px' }}>
              We sent a confirmation link to <strong>{email}</strong>.<br /><br />
              Click the link to activate your sponsor account, then sign in to set up your sponsor profile.
            </p>
            <p style={{ fontSize: '12px', color: '#aeaeb2' }}>
              Didn&apos;t receive it? Check your spam folder.
            </p>
            <button
              onClick={() => { setMessage(''); setIsLogin(true) }}
              style={{ marginTop: '20px', background: 'none', border: 'none', color: '#0071e3', fontSize: '13px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              ← Back to sign in
            </button>
          </div>
        ) : (
          <>
            {/* Toggle */}
            <div style={{ display: 'flex', background: '#f5f5f7', borderRadius: '10px', padding: '4px', marginBottom: '24px' }}>
              <button
                onClick={() => { setIsLogin(true); setError(''); setMessage('') }}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: '600', background: isLogin ? 'white' : 'transparent', color: isLogin ? '#1d1d1f' : '#6e6e73', boxShadow: isLogin ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}
              >
                Sign in
              </button>
              <button
                onClick={() => { setIsLogin(false); setError(''); setMessage('') }}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: '600', background: !isLogin ? 'white' : 'transparent', color: !isLogin ? '#1d1d1f' : '#6e6e73', boxShadow: !isLogin ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}
              >
                Create account
              </button>
            </div>

            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f', marginBottom: '4px' }}>
              {isLogin ? 'Welcome back' : 'Become a sponsor'}
            </div>
            <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '24px', lineHeight: '1.6' }}>
              {isLogin
                ? 'Sign in to your ohACCESS sponsor dashboard.'
                : 'Co-brand the open houses of the agents you work with. Your card appears alongside theirs in every visitor email.'}
            </div>

            <form onSubmit={handleAuth}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  style={{ width: '100%', background: '#f5f5f7', border: '1px solid #d1d1d6', borderRadius: '9px', padding: '10px 12px', fontSize: '14px', color: '#1d1d1f', outline: 'none', boxSizing: 'border-box' as const, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={isLogin ? 'Your password' : 'Create a password (min 8 characters)'}
                    required
                    minLength={8}
                    style={{ width: '100%', background: '#f5f5f7', border: '1px solid #d1d1d6', borderRadius: '9px', padding: '10px 40px 10px 12px', fontSize: '14px', color: '#1d1d1f', outline: 'none', boxSizing: 'border-box' as const, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: '6px 8px', cursor: 'pointer', color: '#6e6e73', display: 'flex', alignItems: 'center' }}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px', fontSize: '12px', color: '#6e6e73', lineHeight: '1.5', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={e => setAgreedToTerms(e.target.checked)}
                    style={{ marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span>
                    I agree to the <a href="/subscriber-terms" target="_blank" rel="noopener noreferrer" style={{ color: '#0071e3', textDecoration: 'underline' }}>Subscriber Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#0071e3', textDecoration: 'underline' }}>Privacy Policy</a>.
                  </span>
                </label>
              )}

              {error && (
                <div style={{ background: '#fff0f0', color: '#cc0000', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', lineHeight: '1.5' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', background: '#1d1d1f', color: 'white', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Please wait...' : isLogin ? 'Sign in →' : 'Create sponsor account →'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '12px', color: '#aeaeb2', lineHeight: '1.6' }}>
              {isLogin ? (
                <a href="/reset-password" style={{ color: '#aeaeb2', textDecoration: 'none' }}>Forgot your password?</a>
              ) : (
                <>Real estate agent? <a href="/login" style={{ color: '#6e6e73' }}>Sign up here instead</a>.</>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
