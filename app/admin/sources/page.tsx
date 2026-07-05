'use client'

import { Fragment, useEffect, useState } from 'react'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'

type SourceAgent = {
  name: string
  email: string
  tier: string
  created_at: string
}

type SourceRow = {
  source: string
  signups: number
  pro: number
  conversion_pct: number
  first_signup: string
  last_signup: string
  agents: SourceAgent[]
}

export default function AdminSourcesPage() {
  const [rows, setRows] = useState<SourceRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

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
                  <Fragment key={r.source}>
                    <tr
                      onClick={() => setExpanded(expanded === r.source ? null : r.source)}
                      style={{ borderTop: '1px solid #e5e5ea', cursor: 'pointer' }}
                      title="Click to see who signed up with this link"
                    >
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#1d1d1f' }}>
                        <span style={{ marginRight: 8, fontSize: 10, color: '#6e6e73' }}>{expanded === r.source ? '▼' : '▶'}</span>
                        {r.source}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#1d1d1f' }}>{r.signups}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#1d1d1f' }}>{r.pro}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#1d1d1f' }}>{r.conversion_pct}%</td>
                      <td style={{ padding: '12px 14px', color: '#6e6e73' }}>{fmt(r.first_signup)}</td>
                      <td style={{ padding: '12px 14px', color: '#6e6e73' }}>{fmt(r.last_signup)}</td>
                    </tr>
                    {expanded === r.source && (
                      <tr style={{ borderTop: '1px solid #f0f0f2', background: '#fafafa' }}>
                        <td colSpan={6} style={{ padding: '10px 14px 14px 36px' }}>
                          {(r.agents || []).map((a) => (
                            <div key={a.email + a.created_at} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '4px 0', fontSize: 13 }}>
                              <span style={{ fontWeight: 600, color: '#1d1d1f' }}>{a.name}</span>
                              <span style={{ color: '#6e6e73', fontSize: 12 }}>{a.email}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: a.tier !== 'free' ? '#1f9d55' : '#6e6e73', background: a.tier !== 'free' ? '#e6f6ec' : '#f0f0f2', padding: '1px 8px', borderRadius: 10 }}>
                                {a.tier}
                              </span>
                              <span style={{ color: '#6e6e73', fontSize: 12, marginLeft: 'auto' }}>{fmt(a.created_at)}</span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  )
}
