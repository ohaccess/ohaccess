'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    try {
      if (isLogin) {
        // Use Supabase directly on client side
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        
        if (error) {
          setMessage(error.message)
        } else if (data.session) {
          window.location.href = '/dashboard'
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`
          }
        })
        
        if (error) {
          setMessage(error.message)
        } else {
          // Create profile
          if (data.user) {
            await supabase.from('profiles').insert({
              id: data.user.id,
              email: email,
              tier: 'free'
            })
          }
          setMessage('Account created! You can now sign in.')
          setIsLogin(true)
        }
      }
    } catch {
      setMessage('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#f5f5f7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
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
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontSize: '28px',
            fontWeight: '200',
            color: '#1d1d1f',
            letterSpacing: '-0.5px'
          }}>
            oh<span style={{ fontWeight: '700' }}>ACCESS</span>
          </div>
          <div style={{ fontSize: '13px', color: '#6e6e73', marginTop: '4px' }}>
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: '600',
              color: '#6e6e73',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              marginBottom: '6px'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="david@ohaccess.com"
              required
              style={{
                width: '100%',
                background: '#f5f5f7',
                border: '1px solid #d1d1d6',
                borderRadius: '9px',
                padding: '10px 12px',
                fontSize: '14px',
                color: '#1d1d1f',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: '600',
              color: '#6e6e73',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              marginBottom: '6px'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                background: '#f5f5f7',
                border: '1px solid #d1d1d6',
                borderRadius: '9px',
                padding: '10px 12px',
                fontSize: '14px',
                color: '#1d1d1f',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {message && (
            <div style={{
              background: message.includes('created') ? '#e8f9ee' : '#fff0f0',
              color: message.includes('created') ? '#1a7a3c' : '#cc0000',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: '#1d1d1f',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '13px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            onClick={() => { setIsLogin(!isLogin); setMessage('') }}
            style={{
              background: 'none',
              border: 'none',
              color: '#0071e3',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </main>
  )
}