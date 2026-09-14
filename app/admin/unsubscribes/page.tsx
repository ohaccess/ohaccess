'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'

type Row = { email: string; opted_out_at: string; sources: string[] }

const SOURCE_LABELS: Record<string, string> = {
  marketing_unsubscribe: 'Marketing email',
  invite_unsubscribe: 'Open-house invite',
  agent_tips: 'Agent tips & reminders',
}
const label = (s: string) => SOURCE_LABELS[s] || s

const FILTERS = [
  { key: 'all', name: 'All' },
  { key: 'marketing_unsubscribe', name: 'Marketing email' },
  { key: 'invite_unsubscribe', name: 'Open-house invite' },
  { key: 'agent_tips', name: 'Agent tips & reminders' },
]

export default function AdminUnsubscribesPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/login'
        return
      }
      const res = await fetch('/api/admin/unsubscribes', {
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
      setRows(json.unsubscribes || [])
      setLoading(false)
    }
    load()
  }, [])

  const count = (key: string) => rows?.filter((r) => r.sources.includes(key)).length ?? 0
  const shown = (rows || []).filter((r) => filter === 'all' || r.sources.includes(filter))
  const fmt = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

  const downloadCsv = () => {
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`
    const lines = [
      ['Email', 'Unsubscribed at', 'From'].map(q).join(','),
      ...shown.map((r) => [r.email, r.opted_out_at, r.sources.map(label).join('; ')].map(q).join(',')),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ohaccess-unsubscribes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stat = (title: string, value: number) => (
    <div style={{ flex: 1, minWidth: 150, padding: 14, background: '#f5f5f7', borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#1d1d1f', marginTop: 4 }}>{value}</div>
    </div>
  )

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 20px', fontFamily: 'Arial, sans-serif' }}>
      <a href="/admin" style={{ fontSize: 13, color: '#6e6e73', textDecoration: 'none' }}>← Admin</a>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1d1d1f', margin: '8px 0 4px' }}>
        Unsubscribes
      </h1>
      <div style={{ fontSize: 13, color: '#6e6e73', marginBottom: 24 }}>
        Everyone who asked ohACCESS to stop emailing them. Link for marketing emails:{' '}
        <code style={{ background: '#f5f5f7', padding: '2px 6px', borderRadius: 4 }}>https://ohaccess.com/unsubscribe</code>
      </div>

      {loading && <div style={{ color: '#6e6e73' }}>Loading…</div>}

      {error && (
        <div style={{ padding: 16, background: '#fff0f0', borderRadius: 10, color: '#cc0000', fontSize: 14 }}>
          {error}
        </div>
      )}

      {!loading && !error && rows && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {stat('Total', rows.length)}
            {stat('Marketing email', count('marketing_unsubscribe'))}
            {stat('Open-house invite', count('invite_unsubscribe'))}
            {stat('Agent tips', count('agent_tips'))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  fontSize: 13, fontWeight: 600, borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
                  border: '1px solid #e5e5ea',
                  background: filter === f.key ? '#1d1d1f' : 'white',
                  color: filter === f.key ? 'white' : '#1d1d1f',
                }}
              >
                {f.name}
              </button>
            ))}
            <button
              onClick={downloadCsv}
              disabled={shown.length === 0}
              style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, borderRadius: 9, padding: '7px 14px', cursor: shown.length ? 'pointer' : 'default', border: '1px solid #e5e5ea', background: '#f5f5f7', color: '#1d1d1f', opacity: shown.length ? 1 : 0.5 }}
            >
              📥 Download CSV
            </button>
          </div>

          {shown.length === 0 ? (
            <div style={{ padding: 24, background: '#f5f5f7', borderRadius: 10, color: '#6e6e73', fontSize: 14, textAlign: 'center' }}>
              No unsubscribes yet.
            </div>
          ) : (
            <div style={{ background: 'white', border: '1px solid #e5e5ea', borderRadius: 10, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f5f5f7', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: '#1d1d1f' }}>Email</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: '#1d1d1f' }}>Unsubscribed</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, color: '#1d1d1f' }}>From</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.email} style={{ borderTop: '1px solid #e5e5ea' }}>
                      <td style={{ padding: '12px 14px', color: '#1d1d1f' }}>{r.email}</td>
                      <td style={{ padding: '12px 14px', color: '#6e6e73', whiteSpace: 'nowrap' }}>{fmt(r.opted_out_at)}</td>
                      <td style={{ padding: '12px 14px', color: '#6e6e73' }}>{r.sources.map(label).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  )
}
