'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { onColor, readableOnLight, fillBorder } from '@/lib/colors'
import { timelineRank } from '@/lib/timeline'
import { useSortable, applySort, type SortState, type Sortable } from '@/lib/sort'

interface AgentRollup {
  id: string
  full_name: string | null
  email: string | null
  open_house_count: number
  visitor_count: number
  verified_count: number
}
interface OpenHouseRow {
  id: string
  agent_id: string
  agent_name: string
  property_address: string
  open_house_date: string | null
  open_house_hours: string | null
  status: string
  visitor_count: number
  verified_count: number
}
interface Visitor {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  purchasing_timeline: string | null
  registered_at: string
  verified: boolean
}
interface Totals {
  agents: number
  openHouses: number
  visitors: number
  verified: number
}

const card = {
  background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6',
  padding: '20px 22px', marginBottom: '16px',
}
const cardHeader = {
  fontSize: '13px', fontWeight: 600, color: '#1d1d1f', marginBottom: '4px',
  paddingBottom: '12px', borderBottom: '1px solid #d1d1d6',
}
const th = {
  textAlign: 'left' as const, padding: '8px', fontSize: '10px', fontWeight: 600,
  color: '#6e6e73', textTransform: 'uppercase' as const, letterSpacing: '0.5px',
  borderBottom: '1px solid #d1d1d6', whiteSpace: 'nowrap' as const,
}
const td = {
  padding: '8px', borderBottom: '1px solid #f2f2f7', color: '#6e6e73',
  whiteSpace: 'nowrap' as const,
}

// Click-to-sort header cell, matching the admin tables' behavior.
function SortTh({ label, k, state, onSort }: { label: string; k: string; state: SortState; onSort: (k: string) => void }) {
  const active = state.key === k
  return (
    <th onClick={() => onSort(k)} style={{ ...th, cursor: 'pointer', userSelect: 'none' as const }}>
      {label}
      <span style={{ marginLeft: '4px', fontSize: '9px', color: active ? '#1d1d1f' : '#c7c7cc' }}>
        {active ? (state.dir === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </th>
  )
}

const AGENT_COLUMNS: { label: string; key: string }[] = [
  { label: 'Agent', key: 'agent' },
  { label: 'Open Houses', key: 'openHouses' },
  { label: 'Registrations', key: 'registrations' },
  { label: 'Verified', key: 'verified' },
]
const AGENT_ACC: Record<string, (a: AgentRollup) => Sortable> = {
  agent: (a) => a.full_name || a.email,
  openHouses: (a) => a.open_house_count,
  registrations: (a) => a.visitor_count,
  verified: (a) => a.verified_count,
}
const VISITOR_COLUMNS: { label: string; key: string }[] = [
  { label: 'Name', key: 'name' },
  { label: 'Phone', key: 'phone' },
  { label: 'Email', key: 'email' },
  { label: 'Timeline', key: 'timeline' },
  { label: 'Registered', key: 'time' },
  { label: '✓', key: 'verified' },
]
const VISITOR_ACC: Record<string, (v: Visitor) => Sortable> = {
  name: (v) => `${v.first_name || ''} ${v.last_name || ''}`.trim(),
  phone: (v) => v.phone,
  email: (v) => v.email,
  timeline: (v) => timelineRank(v.purchasing_timeline),
  time: (v) => (v.registered_at ? new Date(v.registered_at).getTime() : null),
  verified: (v) => !!v.verified,
}

export default function TeamActivityPanel({ supabase, showToast, primaryColor, accentColor }: {
  supabase: any
  showToast: (m: string, t?: 'success' | 'error') => void
  primaryColor: string
  accentColor: string
}) {
  // Keep accent-colored text and buttons readable if the agent picks a
  // near-white accent (see lib/colors).
  const onAccent = onColor(accentColor)
  const accentText = readableOnLight(accentColor)
  const onPrimary = onColor(primaryColor)
  const primaryBtnBorder = fillBorder(primaryColor)
  const [loading, setLoading] = useState(true)
  const [agents, setAgents] = useState<AgentRollup[]>([])
  const [openHouses, setOpenHouses] = useState<OpenHouseRow[]>([])
  const [totals, setTotals] = useState<Totals>({ agents: 0, openHouses: 0, visitors: 0, verified: 0 })
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [selectedOH, setSelectedOH] = useState<OpenHouseRow | null>(null)
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [visitorsLoading, setVisitorsLoading] = useState(false)

  const agentSort = useSortable('registrations', 'desc')
  const sortedAgents = useMemo(
    () => applySort(agents, AGENT_ACC[agentSort.state.key] || AGENT_ACC.registrations, agentSort.state.dir),
    [agents, agentSort.state]
  )
  const visitorSort = useSortable('time', 'desc')
  const sortedVisitors = useMemo(
    () => applySort(visitors, VISITOR_ACC[visitorSort.state.key] || VISITOR_ACC.time, visitorSort.state.dir),
    [visitors, visitorSort.state]
  )

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }, [supabase])

  const load = useCallback(async () => {
    const res = await fetch('/api/team/activity', { headers: await authHeaders() })
    if (!res.ok) { setLoading(false); return }
    const json = await res.json()
    setAgents(json.agents)
    setOpenHouses(json.openHouses)
    setTotals(json.totals)
    setLoading(false)
  }, [authHeaders])

  useEffect(() => { load() }, [load])

  const openVisitorLog = async (oh: OpenHouseRow) => {
    setSelectedOH(oh)
    setVisitors([])
    setVisitorsLoading(true)
    const res = await fetch(`/api/team/activity/${oh.id}/visitors`, { headers: await authHeaders() })
    const json = await res.json()
    if (res.ok) setVisitors(json.visitors)
    else showToast(json.error || 'Could not load visitor log', 'error')
    setVisitorsLoading(false)
  }

  const exportCSV = () => {
    if (!selectedOH) return
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Timeline', 'Registered', 'Verified']
    const rows = visitors.map(v => [
      v.first_name, v.last_name, v.email, v.phone, v.purchasing_timeline,
      new Date(v.registered_at).toLocaleString(), v.verified ? 'Yes' : 'No',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedOH.property_address}-visitors.csv`
    a.click()
  }

  if (loading) return <div style={{ color: '#6e6e73', fontSize: '14px', padding: '20px' }}>Loading team activity…</div>

  const visibleOpenHouses = agentFilter === 'all'
    ? openHouses
    : openHouses.filter(oh => oh.agent_id === agentFilter)

  return (
    <>
      <div style={{ fontSize: '24px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>Brokerage activity</div>
      <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '16px' }}>
        Every open house and visitor log across your entire brokerage.
      </div>

      {/* BROKERAGE-WIDE TOTALS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Agents', value: totals.agents },
          { label: 'Open Houses', value: totals.openHouses },
          { label: 'Total Registrations', value: totals.visitors, accent: true },
          { label: 'Verified at Door', value: totals.verified },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '16px 18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{stat.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 600, color: stat.accent ? accentText : '#1d1d1f', letterSpacing: '-1px' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* BY AGENT */}
      <div style={card}>
        <div style={cardHeader}>By agent</div>
        {agents.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6e6e73', padding: '20px', fontSize: '13px' }}>No agents on your team yet. Invite agents from the Team tab.</div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '460px' }}>
              <thead>
                <tr>
                  {AGENT_COLUMNS.map(col => (
                    <SortTh key={col.key} label={col.label} k={col.key} state={agentSort.state} onSort={agentSort.onSort} />
                  ))}
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {sortedAgents.map((a, i) => (
                  <tr key={a.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ ...td, color: '#1d1d1f', fontWeight: 500 }}>{a.full_name || a.email}</td>
                    <td style={td}>{a.open_house_count}</td>
                    <td style={td}>{a.visitor_count}</td>
                    <td style={td}>{a.verified_count}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button
                        onClick={() => setAgentFilter(agentFilter === a.id ? 'all' : a.id)}
                        style={{ background: agentFilter === a.id ? accentColor : '#f5f5f7', color: agentFilter === a.id ? onAccent : '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '7px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}
                      >
                        {agentFilter === a.id ? 'Showing' : 'View open houses'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ALL OPEN HOUSES */}
      <div style={card}>
        <div style={{ ...cardHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Open houses{agentFilter !== 'all' ? ' — filtered' : ''}</span>
          {agentFilter !== 'all' && (
            <button onClick={() => setAgentFilter('all')} style={{ background: 'none', border: '1px solid #d1d1d6', color: '#6e6e73', borderRadius: '7px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Show all agents</button>
          )}
        </div>
        {visibleOpenHouses.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6e6e73', padding: '20px', fontSize: '13px' }}>No open houses yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {visibleOpenHouses.map(oh => (
              <div key={oh.id} onClick={() => openVisitorLog(oh)}
                style={{ background: selectedOH?.id === oh.id ? '#f5f9ff' : 'white', border: `1px solid ${selectedOH?.id === oh.id ? accentText : '#d1d1d6'}`, borderRadius: '14px', padding: '12px 16px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: oh.status === 'active' ? accentText : '#aeaeb2', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1d1d1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{oh.property_address}</div>
                    <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '2px' }}>
                      👤 {oh.agent_name}{oh.open_house_date ? ` · ${oh.open_house_date}` : ''}{oh.open_house_hours ? ` · ${oh.open_house_hours}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6e6e73', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <strong style={{ color: '#1d1d1f' }}>{oh.visitor_count}</strong> registered · {oh.verified_count} verified
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VISITOR LOG FOR SELECTED OPEN HOUSE */}
      {selectedOH && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1d1d1f' }}>
              Visitor log — {selectedOH.property_address}
              <span style={{ color: '#6e6e73', fontWeight: 400 }}> · {selectedOH.agent_name}</span>
            </div>
            <button onClick={exportCSV} disabled={visitors.length === 0} style={{ background: primaryColor, color: onPrimary, border: primaryBtnBorder, padding: '6px 13px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: visitors.length === 0 ? 'not-allowed' : 'pointer', opacity: visitors.length === 0 ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Export CSV</button>
          </div>
          {visitorsLoading ? (
            <div style={{ textAlign: 'center', color: '#6e6e73', padding: '20px', fontSize: '13px' }}>Loading visitors…</div>
          ) : visitors.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6e6e73', padding: '20px', fontSize: '13px' }}>No visitors registered at this open house yet.</div>
          ) : (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '500px' }}>
                <thead>
                  <tr>
                    {VISITOR_COLUMNS.map(col => (
                      <SortTh key={col.key} label={col.label} k={col.key} state={visitorSort.state} onSort={visitorSort.onSort} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedVisitors.map((v, i) => (
                    <tr key={v.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ ...td }}>{v.first_name} {v.last_name}</td>
                      <td style={td}>{v.phone}</td>
                      <td style={td}>{v.email}</td>
                      <td style={td}>{v.purchasing_timeline}</td>
                      <td style={td}>{new Date(v.registered_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td style={td}>{v.verified ? <span style={{ color: '#30d158', fontWeight: 700 }}>✓</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  )
}
