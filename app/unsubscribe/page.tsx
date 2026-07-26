'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

// Landing page for the Unsubscribe link in open-house invite emails.
// Deliberately a confirm-button page (not auto-fire on load): email security
// scanners prefetch links, and a GET side effect would silently unsubscribe
// people who never clicked. One tap here → POST /api/unsubscribe → done.

function UnsubscribeInner() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')

  const unsubscribe = async () => {
    setState('working')
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
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

        {!token ? (
          <>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f', marginBottom: '8px' }}>This link is incomplete</div>
            <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: 1.6 }}>Please use the Unsubscribe link at the bottom of the email you received.</div>
          </>
        ) : state === 'done' ? (
          <>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✓</div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f', marginBottom: '8px' }}>You&rsquo;re unsubscribed</div>
            <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: 1.6 }}>
              You won&rsquo;t receive open-house invite emails anymore.<br />
              Sign-in confirmations for open houses you visit are unaffected.
            </div>
          </>
        ) : state === 'error' ? (
          <>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f', marginBottom: '8px' }}>Something went wrong</div>
            <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: 1.6, marginBottom: '20px' }}>The link may have expired. Please try again, or contact support@ohaccess.com.</div>
            <button onClick={unsubscribe} style={{ background: '#1d1d1f', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 28px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Try again</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f', marginBottom: '8px' }}>Stop receiving open-house invites?</div>
            <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: 1.6, marginBottom: '24px' }}>
              You&rsquo;ll no longer get emails inviting you to upcoming open houses.
              This applies to invites from all agents on ohACCESS.
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
