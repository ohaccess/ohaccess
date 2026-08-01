'use client'

import { useEffect, useState } from 'react'

export const IMPERSONATION_KEY = 'ohaccess_impersonation'

type Record = {
  adminAccessToken: string
  adminRefreshToken: string
  agentName: string
  agentEmail: string
}

export default function ImpersonationBanner() {
  const [record, setRecord] = useState<Record | null>(null)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    // Read the impersonation record from localStorage on mount. This must run
    // in an effect (not during render) to avoid an SSR hydration mismatch.
    try {
      const raw = localStorage.getItem(IMPERSONATION_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setRecord(JSON.parse(raw) as Record)
    } catch {
      // ignore malformed record
    }
  }, [])

  if (!record) return null

  const exit = async () => {
    setExiting(true)
    try {
      // Loaded on demand: this banner sits in the root layout, so a top-level
      // supabase import would ship the whole client library (~56KB gz) on
      // every page of the site just for this admin-only button.
      const { supabaseBrowser: supabase } = await import('@/lib/supabase-browser')
      await supabase.auth.setSession({
        access_token: record.adminAccessToken,
        refresh_token: record.adminRefreshToken,
      })
    } catch {
      // If restoring the admin session fails, fall through to a clean login.
    }
    localStorage.removeItem(IMPERSONATION_KEY)
    // Hard navigation so every client re-reads the restored session.
    if (typeof window !== 'undefined') {
      window.location.href = '/admin'
    }
  }

  return (
    <div
      style={{
        background: '#1d1d1f',
        color: 'white',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        flexWrap: 'wrap',
        fontFamily: '"Plus Jakarta Sans", Arial, sans-serif',
        fontSize: 13,
        zIndex: 1000,
      }}
    >
      <span>
        👁 You are signed in as <strong>{record.agentName}</strong>{' '}
        <span style={{ opacity: 0.7 }}>({record.agentEmail})</span> — changes you make affect their account.
      </span>
      <button
        onClick={exit}
        disabled={exiting}
        style={{
          background: 'white',
          color: '#1d1d1f',
          border: 'none',
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: 13,
          fontWeight: 700,
          cursor: exiting ? 'default' : 'pointer',
          opacity: exiting ? 0.6 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {exiting ? 'Returning…' : 'Return to admin'}
      </button>
    </div>
  )
}
