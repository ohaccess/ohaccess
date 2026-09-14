'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

// Landing page for the Unsubscribe link in open-house invite emails
// (?token=…), in the agent lifecycle emails (?agent=…), and the plain
// ohaccess.com/unsubscribe link in marketing emails (no token: the person
// types their address; ?email=… pre-fills it) — the copy adapts to which
// audience arrived. Deliberately a confirm-button page (not
// auto-fire on load): email security scanners prefetch links, and a GET side
// effect would silently unsubscribe people who never clicked. One tap here →
// POST /api/unsubscribe → done.

function UnsubscribeInner() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const agentToken = params.get('agent') || ''
  // Which agent email the link was in (?from=tips|weekend_games), passed
  // through so the admin Unsubscribes list can show it.
  const from = params.get('from') || ''
  const isAgent = !token && !!agentToken
  const isMarketing = !token && !agentToken
  const [email, setEmail] = useState(params.get('email') || '')
  const [emailError, setEmailError] = useState('')
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')

  const unsubscribe = async () => {
    if (isMarketing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Please enter a valid email address.')
      return
    }
    setEmailError('')
    setState('working')
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isMarketing ? { email: email.trim() } : isAgent ? { agent: agentToken, from } : { token }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  const card: React.CSSProperties = {
    background: 'white', borderRadius: '22px', padding: '36px 32px', maxWidth: '440px',
    width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" }}>
      <div style={card}>
        <div style={{ fontSize: '22px', fontWeight: 300, color: '#1d1d1f', marginBottom: '20px' }}>oh<strong style={{ fontWeight: 800 }}>ACCESS</strong></div>

        {state === 'done' ? (
          <>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✓</div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f', marginBottom: '8px' }}>You&rsquo;re unsubscribed</div>
            <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: 1.6 }}>
              {isMarketing ? (
                <>
                  {`${email.trim()} won't receive marketing emails from ohACCESS anymore.`}<br />
                  Emails you need, like codewords at open houses you visit and updates about your own account, will keep working.
                </>
              ) : isAgent ? (
                <>
                  You won&rsquo;t receive tips or reminder emails from ohACCESS anymore.<br />
                  Emails about your own open houses (reminders and reports) are unaffected.
                </>
              ) : (
                <>
                  You won&rsquo;t receive open-house invite emails anymore.<br />
                  Sign-in confirmations for open houses you visit are unaffected.
                </>
              )}
            </div>
          </>
        ) : state === 'error' ? (
          <>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f', marginBottom: '8px' }}>Something went wrong</div>
            <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: 1.6, marginBottom: '20px' }}>
              {isMarketing ? 'Please try again, or contact support@ohaccess.com.' : 'The link may have expired. Please try again, or contact support@ohaccess.com.'}
            </div>
            <button onClick={unsubscribe} style={{ background: '#1d1d1f', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 28px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Try again</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f', marginBottom: '8px' }}>
              {isMarketing ? 'Unsubscribe from ohACCESS emails' : isAgent ? 'Stop receiving tips and reminders?' : 'Stop receiving open-house invites?'}
            </div>
            <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: 1.6, marginBottom: '24px' }}>
              {isMarketing ? (
                <>
                  Enter your email address and we&rsquo;ll stop sending you marketing emails.
                  Emails you need, like codewords at open houses you visit and updates about your own account, will keep working.
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(ev) => { setEmail(ev.target.value); setEmailError('') }}
                    onKeyDown={(ev) => { if (ev.key === 'Enter') unsubscribe() }}
                    style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '18px', padding: '12px 14px', fontSize: '15px', border: `1px solid ${emailError ? '#cc0000' : '#d2d2d7'}`, borderRadius: '10px', fontFamily: 'inherit', color: '#1d1d1f' }}
                  />
                  {emailError && <div style={{ fontSize: '13px', color: '#cc0000', marginTop: '6px', textAlign: 'left' }}>{emailError}</div>}
                </>
              ) : isAgent ? (
                <>
                  You&rsquo;ll no longer get occasional tips, reminders, or offers from ohACCESS.
                  Emails about your own open houses (reminders and reports) will keep working.
                </>
              ) : (
                <>
                  You&rsquo;ll no longer get emails inviting you to upcoming open houses.
                  This applies to invites from all agents on ohACCESS.
                </>
              )}
            </div>
            <button disabled={state === 'working'} onClick={unsubscribe} style={{ background: '#1d1d1f', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 28px', fontSize: '14px', fontWeight: 600, cursor: state === 'working' ? 'wait' : 'pointer', opacity: state === 'working' ? 0.6 : 1, fontFamily: 'inherit' }}>
              {state === 'working' ? 'Unsubscribing…' : 'Unsubscribe'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function UnsubscribePage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <UnsubscribeInner />
    </Suspense>
  )
}
