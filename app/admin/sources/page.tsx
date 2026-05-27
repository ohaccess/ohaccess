'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type SourceRow = {
  source: string
  signups: number
  pro: number
  conversion_pct: number
  first_signup: string
  last_signup: string
}

export default function AdminSourcesPage() {
  const [rows, setRows] = useState<SourceRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/login'
        return
      }
      const res = await fetch('/api/admin/sources', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.status === 403) {
        setError('Not authorized.')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError(`Failed to load (${res.status}).`)
        setLoading(false)
        return
      }
      const json = await res.json()
      setRows(json.sources || [])
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (iso: string) => new Date(iso).toLocaleDateString()
  const totalSignups = rows?.reduce((s, r) => s + r.signups, 0) ?? 0
  const totalPro = rows?.reduce((s, r) => s + r.pro, 0) ?? 0

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1d1d1f', marginBottom: 4 }}>
        Referral Sources
      </h1>
      <div style={{ fontSize: 13, color: '#6e6e73', marginBottom: 24 }}>
        Tracks signups by the <code style={{ background: '#f5f5f7', padding: '2px 6px', borderRadius: 4 }}>?ref=</code> query parameter (30-day attribution window, first-touch wins).
      </div>

      {loading && <div style={{ color: '#6e6e73' }}>Loading…</div>}

      {error && (
        <div style={{ padding: 16, background: '#fff0f0', borderRadius: 10, color: '#cc0000', fontSize: 14 }}>
          {error}
        </div>
      )}

      {!loading && !error && rows && rows.length === 0 && (
        <div style={{ padding: 24, background: '#f5f5f7', borderRadius: 10, color: '#6e6e73', fontSize: 14, textAlign: 'center' }}>
          No referral sources captured yet. Share a link like <code>ohaccess.com/?ref=yourname</code> to start tracking.
        </div>
      )}

      {!loading && !error && rows && rows.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, padding: 14, background: '#f5f5f7', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 1 }}>Total Tracked Signups</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1d1d1f', marginTop: 4 }}>{totalSignups}</div>
            </div>
            <div style={{ flex: 1, padding: 14, background: '#f5f5f7', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 1 }}>Upgraded to Pro</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1d1d1f', marginTop: 4 }}>{totalPro}</div>
            </div>
            <div style={{ flex: 1, padding: 14, background: '#f5f5f7', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 1 }}>Overall Conversion</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1d1d1f', marginTop: 4 }}>
                {totalSignups > 0 ? `${Math.round((totalPro / totalSignups) * 1000) / 10}%` : '—'}
              </div>
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e5e5ea', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5f7', textAlign: 'left' }}>
                  <th style={{ padding: '12px 14px', fontWeight: 600, color: '#1d1d1f' }}>Source</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, color: '#1d1d1f', textAlign: 'right' }}>Signups</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, color: '#1d1d1f', textAlign: 'right' }}>Pro</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, color: '#1d1d1f', textAlign: 'right' }}>Conversion</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, color: '#1d1d1f' }}>First</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, color: '#1d1d1f' }}>Last</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.source} style={{ borderTop: '1px solid #e5e5ea' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#1d1d1f' }}>{r.source}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#1d1d1f' }}>{r.signups}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#1d1d1f' }}>{r.pro}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#1d1d1f' }}>{r.conversion_pct}%</td>
                    <td style={{ padding: '12px 14px', color: '#6e6e73' }}>{fmt(r.first_signup)}</td>
                    <td style={{ padding: '12px 14px', color: '#6e6e73' }}>{fmt(r.last_signup)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  )
}
