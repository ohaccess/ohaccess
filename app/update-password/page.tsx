'use client'
import { useState, useEffect } from 'react'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import Link from 'next/link'

export default function UpdatePassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    // The reset link lands here with recovery credentials in the URL, and
    // supabase-js parses them at client init — usually BEFORE this effect
    // runs, so the PASSWORD_RECOVERY event fires with nobody listening and
    // waiting for it alone left the page stuck on "Verifying...". Keep the
    // listener (covers slow parses), but also accept an already-established
    // session, exchange a ?code= link ourselves, and surface an expired/used
    // link instead of spinning forever.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) setReady(true)
    })
    ;(async () => {
      // Supabase reports a dead link via error params (hash or query).
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const queryParams = new URLSearchParams(window.location.search)
      if (hashParams.get('error') || queryParams.get('error')) {
        setLinkError('This reset link has expired or was already used.')
        return
      }
      const code = queryParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) setLinkError('This reset link has expired or was already used.')
        else setReady(true)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setReady(true)
    })()
    return () => subscription.unsubscribe()
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 2000)
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
          <div style={{ fontSize: '13px', color: '#6e6e73', marginTop: '4px' }}>
            Set a new password
          </div>
        </div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>
              Password updated!
            </div>
            <p style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.6' }}>
              Your password has been updated. Redirecting you to the dashboard...
            </p>
          </div>
        ) : !ready ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>{linkError ? '⏱️' : '🔗'}</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f', marginBottom: '8px' }}>
              {linkError ? 'Reset link expired' : 'Verifying your reset link...'}
            </div>
            <p style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.6', marginBottom: '24px' }}>
              {linkError || 'If this page doesn’t load, your reset link may have expired. Please request a new one.'}
            </p>
            <Link href="/reset-password" style={{ color: '#0071e3', fontSize: '13px', textDecoration: 'none' }}>
              Request new reset link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleUpdate}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
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

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  style={{ width: '100%', background: '#f5f5f7', border: '1px solid #d1d1d6', borderRadius: '9px', padding: '10px 40px 10px 12px', fontSize: '14px', color: '#1d1d1f', outline: 'none', boxSizing: 'border-box' as const, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(s => !s)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: '6px 8px', cursor: 'pointer', color: '#6e6e73', display: 'flex', alignItems: 'center' }}
                >
                  {showConfirm ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: '#fff0f0', color: '#cc0000', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            {password && confirm && password === confirm && (
              <div style={{ background: '#e8f9ee', color: '#1a7a3c', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                ✓ Passwords match
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', background: '#1d1d1f', color: 'white', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link href="/login" style={{ color: '#0071e3', fontSize: '13px', textDecoration: 'none' }}>
            ← Back to sign in
          </Link>
        </div>
      </div>
    </main>
  )
}