'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function LoginForm() {
  const searchParams = useSearchParams()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // Read pricing-CTA params: plan=pro&interval=month|year|two_year_prepay.
  const planParam = searchParams.get('plan')
  const intervalParam = searchParams.get('interval')
  const hasCheckoutIntent = planParam === 'pro' && !!intervalParam

  // After login succeeds, either start Stripe Checkout (if user came from a pricing CTA)
  // or send them to the dashboard as usual.
  const proceedAfterAuth = async () => {
    if (!hasCheckoutIntent) {
      window.location.href = '/dashboard'
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/dashboard'
      return
    }
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tier: planParam, interval: intervalParam }),
      })
      const json = await res.json()
      if (res.ok && json.url) {
        window.location.href = json.url
        return
      }
      setError(json.error || 'Could not start checkout. Redirecting to dashboard.')
      setTimeout(() => { window.location.href = '/dashboard' }, 1500)
    } catch {
      window.location.href = '/dashboard'
    }
  }

  useEffect(() => {
    if (searchParams.get('signup') === 'true') setIsLogin(false)
    if (searchParams.get('confirmed') === 'true') setConfirmed(true)

    // If the user is already logged in and arrived with checkout intent,
    // skip the form and go straight to Stripe. If the stored refresh token
    // is stale, clear it and let the user re-authenticate via the form
    // instead of surfacing an unhandled rejection.
    if (hasCheckoutIntent) {
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          if (session?.user?.email_confirmed_at) proceedAfterAuth()
        })
        .catch(async () => {
          try { await supabase.auth.signOut() } catch {}
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

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
        await proceedAfterAuth()
        return
      }
    } else {
      // Preserve plan/interval through email-confirmation roundtrip so checkout
      // can resume after the user clicks the confirm link and signs in.
      const confirmUrl = new URL('https://ohaccess.com/login')
      confirmUrl.searchParams.set('confirmed', 'true')
      if (hasCheckoutIntent) {
        confirmUrl.searchParams.set('plan', planParam!)
        confirmUrl.searchParams.set('interval', intervalParam!)
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: confirmUrl.toString(),
        }
      })
      if (error) {
        setError(error.message)
      } else {
        // Record the click-through acceptance for the legal audit trail.
        // Best-effort; if it fails we still let signup succeed (Supabase
        // has already accepted the agreement via the required checkbox).
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
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: '28px', fontWeight: '200', color: '#1d1d1f', letterSpacing: '-0.5px' }}>
              oh<span style={{ fontWeight: '700' }}>ACCESS</span>
            </div>
          </Link>
        </div>

        {/* Email confirmed success */}
        {confirmed && (
          <div style={{ background: '#e8f9ee', border: '1px solid #b2f0c8', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#1a7a3c', textAlign: 'center', fontWeight: '600' }}>
            ✅ Email confirmed! You can now sign in.
          </div>
        )}

        {/* Signup confirmation sent */}
        {message === 'confirmed' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>
              Check your email!
            </div>
            <p style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.6', marginBottom: '24px' }}>
              We sent a confirmation link to <strong>{email}</strong>.<br /><br />
              Click the link in the email to activate your ohACCESS account and start your free trial.
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
              {isLogin ? 'Welcome back' : 'Start your free trial'}
            </div>
            <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '24px' }}>
              {isLogin ? 'Sign in to your ohACCESS dashboard.' : '50 free visitor registrations. No credit card required.'}
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
                {loading ? 'Please wait...' : isLogin ? 'Sign in →' : 'Create account →'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#e5e5ea' }} />
                <div style={{ fontSize: '12px', color: '#aeaeb2', fontWeight: '500' }}>or</div>
                <div style={{ flex: 1, height: '1px', background: '#e5e5ea' }} />
              </div>

              <button
                type="button"
                onClick={async () => {
                  setLoading(true)
                  await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: `https://ohaccess.com/auth/callback`,
                      queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                      },
                      skipBrowserRedirect: false,
                    }
                  })
                  setLoading(false)
                }}
                style={{ width: '100%', background: 'white', color: '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                  <path fill="#34A353" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                  <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
                  <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
                </svg>
                Continue with Google
              </button>
            </form>

            {isLogin && (
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <a href="/reset-password" style={{ color: '#aeaeb2', fontSize: '12px', textDecoration: 'none' }}>
                  Forgot your password?
                </a>
              </div>
            )}

            {!isLogin && (
              <div style={{ marginTop: '16px', fontSize: '11px', color: '#aeaeb2', textAlign: 'center', lineHeight: '1.6' }}>
                By creating an account you agree to the{' '}
                <a href="/terms" style={{ color: '#6e6e73' }}>Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" style={{ color: '#6e6e73' }}>Privacy Policy</a>.
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#f5f5f7', fontSize: '16px', color: '#6e6e73' }}>Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}