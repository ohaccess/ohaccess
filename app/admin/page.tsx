'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { IMPERSONATION_KEY } from '../_components/ImpersonationBanner'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Stats = {
  totalAgents: number
  payingAgents: number
  freeAgents: number
  newAgentsThisWeek: number
  totalOpenHouses: number
  upcomingOpenHouses: number
  pastOpenHouses: number
  totalVisitors: number
  visitorsThisWeek: number
  verifiedVisitors: number
}

type Agent = {
  id: string
  name: string
  email: string
  brokerage: string
  tier: string
  role: string
  subscription_status: string
  billing_interval: string
  current_period_end: string | null
  created_at: string
  openHouseCount: number
  visitorCount: number
}

type OpenHouse = {
  id: string
  address: string
  agentId: string
  agentName: string
  listing_price: string
  open_house_date: string
  open_house_hours: string
  start_at: string | null
  end_at: string | null
  status: string
  code_word: string
  isPast: boolean
  visitorCount: number
  created_at: string
}

type Visitor = {
  id: string
  name: string
  email: string
  phone: string
  purchasing_timeline: string
  verified: boolean
  registered_at: string
  openHouseId: string
  openHouseAddress: string
  agentName: string
}

type Payload = {
  stats: Stats
  agents: Agent[]
  openHouses: OpenHouse[]
  visitors: Visitor[]
  generatedAt: string
}

type Tab = 'overview' | 'agents' | 'openhouses' | 'visitors'
type OHFilter = 'all' | 'upcoming' | 'past'

// ---- styling tokens (match existing app) ----
const INK = '#1d1d1f'
const SUB = '#6e6e73'
const BORDER = '#e5e5ea'
const BLUE = '#0071e3'
const GREEN = '#1f9d55'
const AMBER = '#b25e00'

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—'

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminDashboard() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [query, setQuery] = useState('')
  const [ohFilter, setOhFilter] = useState<OHFilter>('all')
  const [reloadKey, setReloadKey] = useState(0)

  const refresh = () => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }

  const selectTab = (t: Tab) => {
    setTab(t)
    setQuery('')
  }

  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)

  const impersonate = async (agent: Agent) => {
    if (
      !window.confirm(
        `Sign in as ${agent.name}?\n\nYou'll be taken to their dashboard and any changes will affect THEIR account. A banner will let you return to admin at any time.`
      )
    )
      return
    setImpersonatingId(agent.id)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/login'
      return
    }
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: agent.id }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      window.alert(`Could not sign in as agent: ${j.error || res.status}`)
      setImpersonatingId(null)
      return
    }
    const { token_hash, email, name } = await res.json()
    // Save the admin session BEFORE swapping, so the banner can restore it.
    localStorage.setItem(
      IMPERSONATION_KEY,
      JSON.stringify({
        adminAccessToken: session.access_token,
        adminRefreshToken: session.refresh_token,
        agentName: name,
        agentEmail: email,
      })
    )
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
    if (error) {
      localStorage.removeItem(IMPERSONATION_KEY)
      window.alert(`Could not sign in as agent: ${error.message}`)
      setImpersonatingId(null)
      return
    }
    window.location.href = '/dashboard'
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/login'
        return
      }
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (cancelled) return
      if (res.status === 403) {
        setError('Not authorized. Your account is not on the admin allowlist.')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError(`Failed to load (${res.status}).`)
        setLoading(false)
        return
      }
      const json = await res.json()
      if (cancelled) return
      setError(null)
      setData(json)
      setLoading(false)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const q = query.trim().toLowerCase()

  const filteredAgents = useMemo(() => {
    if (!data) return []
    return data.agents.filter(
      (a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.brokerage.toLowerCase().includes(q)
    )
  }, [data, q])

  const filteredOpenHouses = useMemo(() => {
    if (!data) return []
    return data.openHouses
      .filter((o) => (ohFilter === 'all' ? true : ohFilter === 'past' ? o.isPast : !o.isPast))
      .filter(
        (o) =>
          !q ||
          o.address.toLowerCase().includes(q) ||
          o.agentName.toLowerCase().includes(q) ||
          o.code_word.toLowerCase().includes(q)
      )
  }, [data, q, ohFilter])

  const filteredVisitors = useMemo(() => {
    if (!data) return []
    return data.visitors.filter(
      (v) =>
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.email.toLowerCase().includes(q) ||
        v.phone.toLowerCase().includes(q) ||
        v.openHouseAddress.toLowerCase().includes(q) ||
        v.agentName.toLowerCase().includes(q)
    )
  }, [data, q])

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '28px 20px 64px',
        fontFamily: '"Plus Jakarta Sans", Arial, sans-serif',
        color: INK,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
            ohACCESS · Admin
          </h1>
          <div style={{ fontSize: 13, color: SUB, marginTop: 4 }}>
            Everything across every account — agents, open houses, and visitors.
            {data && (
              <span style={{ marginLeft: 8 }}>
                Updated {new Date(data.generatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href="/admin/sources"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: INK,
              background: '#f5f5f7',
              border: `1px solid ${BORDER}`,
              borderRadius: 9,
              padding: '9px 14px',
              textDecoration: 'none',
            }}
          >
            Referral Sources →
          </a>
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'white',
              background: BLUE,
              border: 'none',
              borderRadius: 9,
              padding: '9px 16px',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 24, padding: 16, background: '#fff0f0', borderRadius: 10, color: '#cc0000', fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading && !data && <div style={{ marginTop: 32, color: SUB }}>Loading…</div>}

      {data && !error && (
        <>
          {/* KPI cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
              marginTop: 24,
            }}
          >
            <Kpi label="Agents Signed Up" value={data.stats.totalAgents} sub={`+${data.stats.newAgentsThisWeek} this week`} />
            <Kpi label="Paying Agents" value={data.stats.payingAgents} sub={`${data.stats.freeAgents} free`} accent={GREEN} />
            <Kpi label="Open Houses" value={data.stats.totalOpenHouses} sub={`${data.stats.upcomingOpenHouses} upcoming · ${data.stats.pastOpenHouses} past`} />
            <Kpi label="Total Visitors" value={data.stats.totalVisitors} sub={`+${data.stats.visitorsThisWeek} this week`} accent={BLUE} />
            <Kpi label="Verified Visitors" value={data.stats.verifiedVisitors} sub={`${data.stats.totalVisitors - data.stats.verifiedVisitors} unverified`} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginTop: 28, borderBottom: `1px solid ${BORDER}` }}>
            <TabButton id="overview" tab={tab} setTab={selectTab} label="Overview" />
            <TabButton id="agents" tab={tab} setTab={selectTab} label={`Agents (${data.agents.length})`} />
            <TabButton id="openhouses" tab={tab} setTab={selectTab} label={`Open Houses (${data.openHouses.length})`} />
            <TabButton id="visitors" tab={tab} setTab={selectTab} label={`Visitors (${data.visitors.length})`} />
          </div>

          {/* Controls row (search + filters + export) */}
          {tab !== 'overview' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0', flexWrap: 'wrap' }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tab === 'agents'
                    ? 'Search name, email, brokerage…'
                    : tab === 'openhouses'
                    ? 'Search address, agent, code word…'
                    : 'Search visitor, email, phone, listing…'
                }
                style={{
                  flex: '1 1 280px',
                  background: '#f5f5f7',
                  border: `1px solid #d1d1d6`,
                  borderRadius: 9,
                  padding: '10px 12px',
                  fontSize: 14,
                  color: INK,
                }}
              />
              {tab === 'openhouses' && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['all', 'upcoming', 'past'] as OHFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setOhFilter(f)}
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        color: ohFilter === f ? 'white' : INK,
                        background: ohFilter === f ? INK : '#f5f5f7',
                        border: `1px solid ${ohFilter === f ? INK : '#d1d1d6'}`,
                        borderRadius: 9,
                        padding: '9px 13px',
                        cursor: 'pointer',
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => exportCurrent(tab, data, filteredAgents, filteredOpenHouses, filteredVisitors)} style={exportBtn}>
                Export CSV
              </button>
            </div>
          )}

          {/* Panels */}
          {tab === 'overview' && <Overview data={data} setTab={selectTab} />}
          {tab === 'agents' && (
            <AgentsTable rows={filteredAgents} onImpersonate={impersonate} impersonatingId={impersonatingId} />
          )}
          {tab === 'openhouses' && <OpenHousesTable rows={filteredOpenHouses} />}
          {tab === 'visitors' && <VisitorsTable rows={filteredVisitors} />}
        </>
      )}
    </main>
  )
}

function exportCurrent(
  tab: Tab,
  data: Payload,
  agents: Agent[],
  openHouses: OpenHouse[],
  visitors: Visitor[]
) {
  if (tab === 'agents') {
    downloadCSV(
      'ohaccess-agents.csv',
      ['Name', 'Email', 'Brokerage', 'Tier', 'Role', 'Subscription', 'Billing', 'Open Houses', 'Visitors', 'Joined'],
      agents.map((a) => [
        a.name,
        a.email,
        a.brokerage,
        a.tier,
        a.role,
        a.subscription_status,
        a.billing_interval,
        a.openHouseCount,
        a.visitorCount,
        fmtDate(a.created_at),
      ])
    )
  } else if (tab === 'openhouses') {
    downloadCSV(
      'ohaccess-open-houses.csv',
      ['Address', 'Agent', 'When', 'Hours', 'Status', 'Code Word', 'Price', 'Visitors', 'Created'],
      openHouses.map((o) => [
        o.address,
        o.agentName,
        o.start_at ? fmtDateTime(o.start_at) : o.open_house_date,
        o.open_house_hours,
        o.isPast ? 'Past' : 'Upcoming',
        o.code_word,
        o.listing_price,
        o.visitorCount,
        fmtDate(o.created_at),
      ])
    )
  } else if (tab === 'visitors') {
    downloadCSV(
      'ohaccess-visitors.csv',
      ['Name', 'Email', 'Phone', 'Timeline', 'Verified', 'Open House', 'Agent', 'Registered'],
      visitors.map((v) => [
        v.name,
        v.email,
        v.phone,
        v.purchasing_timeline,
        v.verified ? 'Yes' : 'No',
        v.openHouseAddress,
        v.agentName,
        fmtDateTime(v.registered_at),
      ])
    )
  }
}

function Kpi({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: string }) {
  return (
    <div style={{ padding: '16px 18px', background: '#f5f5f7', borderRadius: 14 }}>
      <div style={{ fontSize: 11, color: SUB, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent || INK, marginTop: 6, lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
      {sub && <div style={{ fontSize: 12, color: SUB, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function TabButton({ id, tab, setTab, label }: { id: Tab; tab: Tab; setTab: (t: Tab) => void; label: string }) {
  const active = tab === id
  return (
    <button
      onClick={() => setTab(id)}
      style={{
        background: 'none',
        border: 'none',
        borderBottom: active ? `2px solid ${INK}` : '2px solid transparent',
        color: active ? INK : SUB,
        fontWeight: active ? 800 : 600,
        fontSize: 14,
        padding: '10px 14px',
        cursor: 'pointer',
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  )
}

const exportBtn: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: INK,
  background: '#f5f5f7',
  border: '1px solid #d1d1d6',
  borderRadius: 9,
  padding: '10px 14px',
  cursor: 'pointer',
}

// ---- shared table primitives ----
const th: React.CSSProperties = { padding: '11px 14px', fontWeight: 700, color: INK, fontSize: 12, textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', color: INK, fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const tdSub: React.CSSProperties = { ...td, color: SUB }

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
      </div>
    </div>
  )
}

function EmptyRow({ span, text }: { span: number; text: string }) {
  return (
    <tr>
      <td colSpan={span} style={{ padding: 32, textAlign: 'center', color: SUB, fontSize: 14 }}>
        {text}
      </td>
    </tr>
  )
}

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )
}

function tierBadge(tier: string, status: string) {
  const s = (status || '').toLowerCase()
  const t = (tier || 'free').toLowerCase()
  if (['active', 'trialing'].includes(s)) return <Badge text={t === 'free' ? 'paying' : t} color={GREEN} bg="#e6f6ec" />
  if (s === 'past_due') return <Badge text="past due" color={AMBER} bg="#fff3e0" />
  if (['canceled', 'unpaid', 'incomplete'].includes(s)) return <Badge text={s} color={SUB} bg="#f0f0f2" />
  return <Badge text="free" color={SUB} bg="#f0f0f2" />
}

function AgentsTable({
  rows,
  onImpersonate,
  impersonatingId,
}: {
  rows: Agent[]
  onImpersonate: (a: Agent) => void
  impersonatingId: string | null
}) {
  return (
    <TableShell>
      <thead>
        <tr style={{ background: '#f5f5f7' }}>
          <th style={th}>Agent</th>
          <th style={th}>Brokerage</th>
          <th style={th}>Plan</th>
          <th style={thR}>Open Houses</th>
          <th style={thR}>Visitors</th>
          <th style={th}>Joined</th>
          <th style={thR}></th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <EmptyRow span={7} text="No agents match." />}
        {rows.map((a) => (
          <tr key={a.id} style={{ borderTop: `1px solid ${BORDER}` }}>
            <td style={td}>
              <div style={{ fontWeight: 600 }}>{a.name}</div>
              <div style={{ fontSize: 12, color: SUB }}>{a.email}</div>
            </td>
            <td style={tdSub}>{a.brokerage || '—'}{a.role === 'brokerage_admin' ? ' (admin)' : ''}</td>
            <td style={td}>{tierBadge(a.tier, a.subscription_status)}</td>
            <td style={tdR}>{a.openHouseCount}</td>
            <td style={tdR}>{a.visitorCount}</td>
            <td style={tdSub}>{fmtDate(a.created_at)}</td>
            <td style={{ ...tdR, whiteSpace: 'nowrap' }}>
              <button
                onClick={() => onImpersonate(a)}
                disabled={impersonatingId === a.id}
                style={{
                  background: '#f5f5f7',
                  color: INK,
                  border: '1px solid #d1d1d6',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: impersonatingId === a.id ? 'default' : 'pointer',
                  opacity: impersonatingId === a.id ? 0.6 : 1,
                }}
              >
                {impersonatingId === a.id ? 'Signing in…' : 'Sign in as'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

function OpenHousesTable({ rows }: { rows: OpenHouse[] }) {
  return (
    <TableShell>
      <thead>
        <tr style={{ background: '#f5f5f7' }}>
          <th style={th}>Listing</th>
          <th style={th}>Agent</th>
          <th style={th}>When</th>
          <th style={th}>Status</th>
          <th style={th}>Code Word</th>
          <th style={thR}>Visitors</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <EmptyRow span={6} text="No open houses match." />}
        {rows.map((o) => (
          <tr key={o.id} style={{ borderTop: `1px solid ${BORDER}` }}>
            <td style={td}>
              <div style={{ fontWeight: 600 }}>{o.address}</div>
              {o.listing_price && <div style={{ fontSize: 12, color: SUB }}>{o.listing_price}</div>}
            </td>
            <td style={tdSub}>{o.agentName}</td>
            <td style={td}>
              <div>{o.start_at ? fmtDateTime(o.start_at) : o.open_house_date || '—'}</div>
              {o.open_house_hours && !o.start_at && <div style={{ fontSize: 12, color: SUB }}>{o.open_house_hours}</div>}
            </td>
            <td style={td}>
              {o.isPast ? (
                <Badge text="Past" color={SUB} bg="#f0f0f2" />
              ) : (
                <Badge text="Upcoming" color={GREEN} bg="#e6f6ec" />
              )}
            </td>
            <td style={{ ...td, fontFamily: 'monospace' }}>{o.code_word || '—'}</td>
            <td style={tdR}>{o.visitorCount}</td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

function VisitorsTable({ rows }: { rows: Visitor[] }) {
  return (
    <TableShell>
      <thead>
        <tr style={{ background: '#f5f5f7' }}>
          <th style={th}>Visitor</th>
          <th style={th}>Contact</th>
          <th style={th}>Timeline</th>
          <th style={th}>Open House</th>
          <th style={th}>Agent</th>
          <th style={th}>Verified</th>
          <th style={th}>Registered</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <EmptyRow span={7} text="No visitors match." />}
        {rows.map((v) => (
          <tr key={v.id} style={{ borderTop: `1px solid ${BORDER}` }}>
            <td style={{ ...td, fontWeight: 600 }}>{v.name}</td>
            <td style={td}>
              <div>{v.email || '—'}</div>
              <div style={{ fontSize: 12, color: SUB }}>{v.phone || '—'}</div>
            </td>
            <td style={tdSub}>{v.purchasing_timeline || '—'}</td>
            <td style={tdSub}>{v.openHouseAddress}</td>
            <td style={tdSub}>{v.agentName}</td>
            <td style={td}>
              {v.verified ? <Badge text="Verified" color={GREEN} bg="#e6f6ec" /> : <Badge text="—" color={SUB} bg="#f0f0f2" />}
            </td>
            <td style={tdSub}>{fmtDateTime(v.registered_at)}</td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

function Overview({ data, setTab }: { data: Payload; setTab: (t: Tab) => void }) {
  const recentAgents = data.agents.slice(0, 6)
  const recentVisitors = data.visitors.slice(0, 8)
  const topAgents = [...data.agents].sort((a, b) => b.visitorCount - a.visitorCount).slice(0, 6)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 24 }}>
      <Panel title="Newest Agents" onMore={() => setTab('agents')}>
        {recentAgents.length === 0 && <Muted>No agents yet.</Muted>}
        {recentAgents.map((a) => (
          <Line key={a.id} left={a.name} sub={a.email} right={fmtDate(a.created_at)} />
        ))}
      </Panel>

      <Panel title="Most Active Agents" onMore={() => setTab('agents')}>
        {topAgents.length === 0 && <Muted>No activity yet.</Muted>}
        {topAgents.map((a) => (
          <Line key={a.id} left={a.name} sub={`${a.openHouseCount} open houses`} right={`${a.visitorCount} visitors`} />
        ))}
      </Panel>

      <Panel title="Latest Visitors" onMore={() => setTab('visitors')}>
        {recentVisitors.length === 0 && <Muted>No visitors yet.</Muted>}
        {recentVisitors.map((v) => (
          <Line key={v.id} left={v.name} sub={v.openHouseAddress} right={fmtDate(v.registered_at)} />
        ))}
      </Panel>
    </div>
  )
}

function Panel({ title, children, onMore }: { title: string; children: React.ReactNode; onMore?: () => void }) {
  return (
    <div style={{ background: 'white', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
        {onMore && (
          <button onClick={onMore} style={{ background: 'none', border: 'none', color: BLUE, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            View all →
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function Line({ left, sub, right }: { left: string; sub: string; right: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: `1px solid #f0f0f2`, gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{left}</div>
        <div style={{ fontSize: 12, color: SUB, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
      </div>
      <div style={{ fontSize: 12, color: SUB, whiteSpace: 'nowrap' }}>{right}</div>
    </div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: SUB, padding: '8px 0' }}>{children}</div>
}
