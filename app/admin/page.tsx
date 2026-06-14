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
  last_sign_in_at: string | null
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
const fmtLogin = (iso: string | null) => (iso ? fmtDateTime(iso) : 'Never')

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

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const deleteAccount = async (agent: Agent) => {
    const typed = window.prompt(
      `⚠️ PERMANENTLY DELETE this account?\n\n` +
        `${agent.name} (${agent.email})\n` +
        `This will also delete their ${agent.openHouseCount} open house(s) and ${agent.visitorCount} visitor(s). ` +
        `This cannot be undone.\n\n` +
        `To confirm, type the agent's email exactly:`
    )
    if (typed == null) return
    if (typed.trim().toLowerCase() !== agent.email.toLowerCase()) {
      window.alert('Email did not match — nothing was deleted.')
      return
    }
    setDeletingId(agent.id)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/login'
      return
    }
    const res = await fetch('/api/admin/delete-account', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: agent.id, confirmEmail: agent.email }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      window.alert(`Could not delete account: ${j.error || res.status}`)
      setDeletingId(null)
      return
    }
    const { deleted: d } = await res.json()
    window.alert(
      `Deleted ${d.name}.\n` +
        `Removed ${d.openHouses} open house(s) and ${d.visitors} visitor(s).` +
        (d.brokeragesDeleted
          ? `\nAlso removed ${d.brokeragesDeleted} team/brokerage and detached ${d.membersDetached} member(s).`
          : '')
    )
    setDeletingId(null)
    refresh()
  }

  const [deletingOHId, setDeletingOHId] = useState<string | null>(null)

  const deleteOpenHouse = async (oh: OpenHouse) => {
    if (
      !window.confirm(
        `Delete this open house?\n\n` +
          `${oh.address}\n` +
          `Agent: ${oh.agentName}\n\n` +
          `This will also delete its ${oh.visitorCount} visitor(s). This cannot be undone.`
      )
    )
      return
    setDeletingOHId(oh.id)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/login'
      return
    }
    const res = await fetch('/api/admin/delete-open-house', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ openHouseId: oh.id }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      window.alert(`Could not delete open house: ${j.error || res.status}`)
      setDeletingOHId(null)
      return
    }
    const { deleted: d } = await res.json()
    window.alert(`Deleted "${d.address}" and its ${d.visitors} visitor(s).`)
    setDeletingOHId(null)
    refresh()
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
    <div style={{ background: '#ffffff', color: INK, minHeight: '100vh', width: '100%' }}>
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
            <AgentsTable
              rows={filteredAgents}
              onImpersonate={impersonate}
              impersonatingId={impersonatingId}
              onDelete={deleteAccount}
              deletingId={deletingId}
            />
          )}
          {tab === 'openhouses' && (
            <OpenHousesTable rows={filteredOpenHouses} onDelete={deleteOpenHouse} deletingId={deletingOHId} />
          )}
          {tab === 'visitors' && <VisitorsTable rows={filteredVisitors} />}
        </>
      )}
    </main>
    </div>
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
      ['Name', 'Email', 'Brokerage', 'Tier', 'Role', 'Subscription', 'Billing', 'Open Houses', 'Visitors', 'Last Login', 'Joined'],
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
        fmtLogin(a.last_sign_in_at),
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

// ---- sorting ----
type SortDir = 'asc' | 'desc'
type SortState = { key: string; dir: SortDir }

function useSortable(defaultKey: string, defaultDir: SortDir = 'asc') {
  const [state, setState] = useState<SortState>({ key: defaultKey, dir: defaultDir })
  const onSort = (k: string) =>
    setState((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }))
  return { state, onSort }
}

type Sortable = string | number | boolean | null

function applySort<T>(rows: T[], get: (r: T) => Sortable, dir: SortDir): T[] {
  const m = dir === 'asc' ? 1 : -1
  return [...rows].sort((x, y) => {
    const a = get(x)
    const b = get(y)
    const an = a === null || a === undefined || a === ''
    const bn = b === null || b === undefined || b === ''
    if (an && bn) return 0
    if (an) return 1 // blanks always sort last, regardless of direction
    if (bn) return -1
    let r: number
    if (typeof a === 'number' && typeof b === 'number') r = a - b
    else if (typeof a === 'boolean' && typeof b === 'boolean') r = a === b ? 0 : a ? 1 : -1
    else r = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
    return r * m
  })
}

function SortTh({
  label,
  k,
  state,
  onSort,
  align,
}: {
  label: string
  k: string
  state: SortState
  onSort: (k: string) => void
  align?: 'right'
}) {
  const active = state.key === k
  return (
    <th
      onClick={() => onSort(k)}
      style={{ ...(align === 'right' ? thR : th), cursor: 'pointer', userSelect: 'none' }}
    >
      {label}
      <span style={{ marginLeft: 4, fontSize: 10, color: active ? INK : '#c7c7cc' }}>
        {active ? (state.dir === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </th>
  )
}

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

const AGENT_ACC: Record<string, (a: Agent) => Sortable> = {
  name: (a) => a.name,
  brokerage: (a) => a.brokerage,
  plan: (a) => a.subscription_status || a.tier,
  openHouseCount: (a) => a.openHouseCount,
  visitorCount: (a) => a.visitorCount,
  lastLogin: (a) => (a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : null),
  joined: (a) => new Date(a.created_at).getTime(),
}

function AgentsTable({
  rows,
  onImpersonate,
  impersonatingId,
  onDelete,
  deletingId,
}: {
  rows: Agent[]
  onImpersonate: (a: Agent) => void
  impersonatingId: string | null
  onDelete: (a: Agent) => void
  deletingId: string | null
}) {
  const { state, onSort } = useSortable('joined', 'desc')
  const sorted = useMemo(() => applySort(rows, AGENT_ACC[state.key], state.dir), [rows, state])
  return (
    <TableShell>
      <thead>
        <tr style={{ background: '#f5f5f7' }}>
          <SortTh label="Agent" k="name" state={state} onSort={onSort} />
          <SortTh label="Brokerage" k="brokerage" state={state} onSort={onSort} />
          <SortTh label="Plan" k="plan" state={state} onSort={onSort} />
          <SortTh label="Open Houses" k="openHouseCount" state={state} onSort={onSort} align="right" />
          <SortTh label="Visitors" k="visitorCount" state={state} onSort={onSort} align="right" />
          <SortTh label="Last Login" k="lastLogin" state={state} onSort={onSort} />
          <SortTh label="Joined" k="joined" state={state} onSort={onSort} />
          <th style={thR}></th>
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 && <EmptyRow span={8} text="No agents match." />}
        {sorted.map((a) => (
          <tr key={a.id} style={{ borderTop: `1px solid ${BORDER}` }}>
            <td style={td}>
              <div style={{ fontWeight: 600 }}>{a.name}</div>
              <div style={{ fontSize: 12, color: SUB }}>{a.email}</div>
            </td>
            <td style={tdSub}>{a.brokerage || '—'}{a.role === 'brokerage_admin' ? ' (admin)' : ''}</td>
            <td style={td}>{tierBadge(a.tier, a.subscription_status)}</td>
            <td style={tdR}>{a.openHouseCount}</td>
            <td style={tdR}>{a.visitorCount}</td>
            <td style={tdSub}>{fmtLogin(a.last_sign_in_at)}</td>
            <td style={tdSub}>{fmtDate(a.created_at)}</td>
            <td style={{ ...tdR, whiteSpace: 'nowrap' }}>
              <div style={{ display: 'inline-flex', gap: 8 }}>
                <button
                  onClick={() => onImpersonate(a)}
                  disabled={impersonatingId === a.id || deletingId === a.id}
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
                <button
                  onClick={() => onDelete(a)}
                  disabled={deletingId === a.id || impersonatingId === a.id}
                  style={{
                    background: 'white',
                    color: '#cc0000',
                    border: '1px solid #f0c0c0',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: deletingId === a.id ? 'default' : 'pointer',
                    opacity: deletingId === a.id ? 0.6 : 1,
                  }}
                >
                  {deletingId === a.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

const OH_ACC: Record<string, (o: OpenHouse) => Sortable> = {
  address: (o) => o.address,
  agentName: (o) => o.agentName,
  when: (o) =>
    o.start_at
      ? new Date(o.start_at).getTime()
      : o.open_house_date && !Number.isNaN(Date.parse(o.open_house_date))
      ? Date.parse(o.open_house_date)
      : new Date(o.created_at).getTime(),
  status: (o) => (o.isPast ? 1 : 0),
  code_word: (o) => o.code_word,
  visitorCount: (o) => o.visitorCount,
}

function OpenHousesTable({
  rows,
  onDelete,
  deletingId,
}: {
  rows: OpenHouse[]
  onDelete: (o: OpenHouse) => void
  deletingId: string | null
}) {
  const { state, onSort } = useSortable('when', 'desc')
  const sorted = useMemo(() => applySort(rows, OH_ACC[state.key], state.dir), [rows, state])
  return (
    <TableShell>
      <thead>
        <tr style={{ background: '#f5f5f7' }}>
          <SortTh label="Listing" k="address" state={state} onSort={onSort} />
          <SortTh label="Agent" k="agentName" state={state} onSort={onSort} />
          <SortTh label="When" k="when" state={state} onSort={onSort} />
          <SortTh label="Status" k="status" state={state} onSort={onSort} />
          <SortTh label="Code Word" k="code_word" state={state} onSort={onSort} />
          <SortTh label="Visitors" k="visitorCount" state={state} onSort={onSort} align="right" />
          <th style={thR}></th>
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 && <EmptyRow span={7} text="No open houses match." />}
        {sorted.map((o) => (
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
            <td style={{ ...tdR, whiteSpace: 'nowrap' }}>
              <button
                onClick={() => onDelete(o)}
                disabled={deletingId === o.id}
                style={{
                  background: 'white',
                  color: '#cc0000',
                  border: '1px solid #f0c0c0',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: deletingId === o.id ? 'default' : 'pointer',
                  opacity: deletingId === o.id ? 0.6 : 1,
                }}
              >
                {deletingId === o.id ? 'Deleting…' : 'Delete'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

const TIMELINE_RANK: Record<string, number> = {
  '0–1 Month': 1,
  '2–3 Months': 2,
  '3–6 Months': 3,
  '6–12 Months': 4,
  '12+ Months': 5,
}
const V_ACC: Record<string, (v: Visitor) => Sortable> = {
  name: (v) => v.name,
  contact: (v) => v.email,
  timeline: (v) => TIMELINE_RANK[v.purchasing_timeline] ?? 99,
  openHouse: (v) => v.openHouseAddress,
  agent: (v) => v.agentName,
  verified: (v) => v.verified,
  registered: (v) => (v.registered_at ? new Date(v.registered_at).getTime() : null),
}

function VisitorsTable({ rows }: { rows: Visitor[] }) {
  const { state, onSort } = useSortable('registered', 'desc')
  const sorted = useMemo(() => applySort(rows, V_ACC[state.key], state.dir), [rows, state])
  return (
    <TableShell>
      <thead>
        <tr style={{ background: '#f5f5f7' }}>
          <SortTh label="Visitor" k="name" state={state} onSort={onSort} />
          <SortTh label="Contact" k="contact" state={state} onSort={onSort} />
          <SortTh label="Timeline" k="timeline" state={state} onSort={onSort} />
          <SortTh label="Open House" k="openHouse" state={state} onSort={onSort} />
          <SortTh label="Agent" k="agent" state={state} onSort={onSort} />
          <SortTh label="Verified" k="verified" state={state} onSort={onSort} />
          <SortTh label="Registered" k="registered" state={state} onSort={onSort} />
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 && <EmptyRow span={7} text="No visitors match." />}
        {sorted.map((v) => (
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
