'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import { timelineRank } from '@/lib/timeline'
import { useSortable, applySort, type SortState, type Sortable } from '@/lib/sort'

// The sponsor dashboard — a 3rd-party provider (lender, title, insurance…)
// who co-brands agents' open houses. Deliberately mirrors the agent
// dashboard's look and feel (same topbar, tabs, cards, and the Team-style
// activity view), with one hard privacy boundary: the ONLY sign-ins a
// sponsor ever sees are those stamped with their sponsor_id — visitors whose
// consent language named this sponsor. Unlike a team lead, a sponsor never
// controls any agent's name, logo, or colors.

const PRIMARY = '#1d1d1f'
const ACCENT = '#0071e3'

const inputStyle = {
  width: '100%', background: '#f5f5f7', border: '1px solid #d1d1d6',
  borderRadius: '9px', padding: '10px 12px', fontSize: '14px', color: '#1d1d1f',
  outline: 'none', boxSizing: 'border-box' as const, fontFamily: "'Plus Jakarta Sans', sans-serif",
}
const labelStyle = {
  display: 'block' as const, fontSize: '11px', fontWeight: '600' as const,
  color: '#6e6e73', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '6px',
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

interface AgentRollup {
  id: string
  full_name: string | null
  email: string | null
  brokerage: string | null
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
  open_house_id: string
  agent_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  purchasing_timeline: string | null
  registered_at: string
  verified: boolean
}
interface Totals { agents: number; openHouses: number; visitors: number; verified: number }
interface Invite { id: string; email: string; expires_at: string; created_at: string }

const AGENT_COLUMNS: { label: string; key: string }[] = [
  { label: 'Agent', key: 'agent' },
  { label: 'Open Houses', key: 'openHouses' },
  { label: 'Sign-ins', key: 'signIns' },
  { label: 'Verified', key: 'verified' },
]
const AGENT_ACC: Record<string, (a: AgentRollup) => Sortable> = {
  agent: (a) => a.full_name || a.email,
  openHouses: (a) => a.open_house_count,
  signIns: (a) => a.visitor_count,
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

type View = 'dashboard' | 'agents' | 'settings'

export default function SponsorDashboard() {
  const [user, setUser] = useState<any>(null)
  const [sponsor, setSponsor] = useState<any>(null)
  const [isNew, setIsNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<View>('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)

  // Activity (Dashboard tab)
  const [activityLoading, setActivityLoading] = useState(true)
  const [agents, setAgents] = useState<AgentRollup[]>([])
  const [openHouses, setOpenHouses] = useState<OpenHouseRow[]>([])
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [totals, setTotals] = useState<Totals>({ agents: 0, openHouses: 0, visitors: 0, verified: 0 })
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [selectedOH, setSelectedOH] = useState<OpenHouseRow | null>(null)

  // Agents tab
  const [invites, setInvites] = useState<Invite[]>([])
  const [seatLimit, setSeatLimit] = useState(10)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session ? { Authorization: `Bearer ${session.access_token}` } : {}
  }, [])

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const res = await fetch('/api/sponsor/activity', { headers: await authHeaders() })
      if (res.ok) {
        const json = await res.json()
        setAgents(json.agents || [])
        setOpenHouses(json.openHouses || [])
        setVisitors(json.visitors || [])
        setTotals(json.totals || { agents: 0, openHouses: 0, visitors: 0, verified: 0 })
      }
    } catch { /* keep whatever we had */ }
    setActivityLoading(false)
  }, [authHeaders])

  const loadInvites = useCallback(async () => {
    try {
      const res = await fetch('/api/sponsor/invitations', { headers: await authHeaders() })
      if (!res.ok) return
      const json = await res.json()
      setInvites(json.invites || [])
      if (json.seatLimit) setSeatLimit(json.seatLimit)
    } catch { /* leave list as-is */ }
  }, [authHeaders])

  useEffect(() => {
    const init = async () => {
      let { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const { data: refreshData } = await supabase.auth.refreshSession()
        session = refreshData.session
      }
      if (!session) { window.location.href = '/sponsor'; return }
      setUser(session.user)

      const { data } = await supabase
        .from('sponsors')
        .select('*')
        .eq('owner_id', session.user.id)
        .maybeSingle()
      if (data) {
        setSponsor(data)
        loadActivity()
        loadInvites()
      } else {
        // First visit: the profile form (Settings) is the only view until
        // the sponsor card exists.
        setIsNew(true)
        setView('settings')
        setSponsor({
          owner_id: session.user.id,
          full_name: '',
          company: '',
          display_email: session.user.email || '',
          phone: '',
          license_number: '',
          headshot_url: '',
          logo_url: '',
          landing_page_url: '',
        })
        setActivityLoading(false)
      }
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const agentSort = useSortable('signIns', 'desc')
  const sortedAgents = useMemo(
    () => applySort(agents, AGENT_ACC[agentSort.state.key] || AGENT_ACC.signIns, agentSort.state.dir),
    [agents, agentSort.state]
  )
  const visitorSort = useSortable('time', 'desc')
  const visibleVisitors = useMemo(
    () => (selectedOH ? visitors.filter(v => v.open_house_id === selectedOH.id) : visitors),
    [visitors, selectedOH]
  )
  const sortedVisitors = useMemo(
    () => applySort(visibleVisitors, VISITOR_ACC[visitorSort.state.key] || VISITOR_ACC.time, visitorSort.state.dir),
    [visibleVisitors, visitorSort.state]
  )

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').substring(0, 10)
    if (digits.length === 0) return ''
    if (digits.length <= 3) return `(${digits}`
    if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  }

  const saveProfile = async () => {
    if (!user) return
    if (!sponsor?.full_name?.trim()) {
      showToast('Please enter your name — it appears on your sponsor card.', 'error')
      return
    }
    setSaving(true)
    const row = {
      full_name: sponsor.full_name || null,
      company: sponsor.company || null,
      display_email: sponsor.display_email || null,
      phone: sponsor.phone || null,
      license_number: sponsor.license_number || null,
      headshot_url: sponsor.headshot_url || null,
      logo_url: sponsor.logo_url || null,
      landing_page_url: sponsor.landing_page_url || null,
    }
    const { data, error } = isNew
      ? await supabase.from('sponsors').insert({ ...row, owner_id: user.id }).select().single()
      : await supabase.from('sponsors').update(row).eq('owner_id', user.id).select().single()
    setSaving(false)
    if (error || !data) {
      showToast('Could not save your profile. Please try again.', 'error')
      return
    }
    setSponsor(data)
    if (isNew) {
      setIsNew(false)
      setView('agents')
      loadActivity()
      loadInvites()
      showToast('Sponsor profile created! Now invite the agents you work with.')
      return
    }
    showToast('Sponsor profile saved!')
  }

  const sendInvite = async () => {
    const email = inviteEmail.trim()
    if (!email) return
    setInviteBusy(true)
    try {
      const res = await fetch('/api/sponsor/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setInviteEmail('')
        showToast(`Invite sent to ${json.email}`)
        await loadInvites()
      } else {
        showToast(json.error || 'Could not send the invite.', 'error')
      }
    } catch {
      showToast('Could not send the invite.', 'error')
    } finally {
      setInviteBusy(false)
    }
  }

  const revokeInvite = async (id: string) => {
    try {
      const res = await fetch(`/api/sponsor/invitations/${id}`, { method: 'DELETE', headers: await authHeaders() })
      if (res.ok) { showToast('Invite revoked.'); await loadInvites() }
      else showToast('Could not revoke the invite.', 'error')
    } catch {
      showToast('Could not revoke the invite.', 'error')
    }
  }

  const removeAgent = async (id: string) => {
    setRemoveConfirm(null)
    try {
      const res = await fetch(`/api/sponsor/agents/${id}`, { method: 'DELETE', headers: await authHeaders() })
      if (res.ok) { showToast('Sponsorship ended.'); await loadActivity() }
      else showToast('Could not remove the agent.', 'error')
    } catch {
      showToast('Could not remove the agent.', 'error')
    }
  }

  const exportCSV = () => {
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Timeline', 'Registered', 'Verified']
    const rows = sortedVisitors.map(v => [
      v.first_name, v.last_name, v.email, v.phone, v.purchasing_timeline,
      new Date(v.registered_at).toLocaleString(), v.verified ? 'Yes' : 'No',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedOH ? selectedOH.property_address : 'sponsored'}-sign-ins.csv`
    a.click()
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/sponsor'
  }

  const navViews: View[] = ['dashboard', 'agents', 'settings']
  const navLabel = (v: View) => (v === 'dashboard' ? 'Dashboard' : v === 'agents' ? 'Agents' : 'Settings')
  const navLabelMobile = (v: View) => (v === 'dashboard' ? '📊 Dashboard' : v === 'agents' ? '👥 Agents' : '⚙️ Settings')

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#f5f5f7' }}>
      <div style={{ fontSize: '16px', color: '#6e6e73' }}>Loading your dashboard...</div>
    </div>
  )

  const visibleOpenHouses = agentFilter === 'all'
    ? openHouses
    : openHouses.filter(oh => oh.agent_id === agentFilter)

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Topbar — same chrome as the agent dashboard, with a Sponsor badge */}
      <div style={{ background: PRIMARY, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '20px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px' }}>
            oh<span style={{ fontWeight: '700' }}>ACCESS</span>
          </div>
          <div style={{ background: 'rgba(201,150,58,0.25)', border: '1px solid rgba(201,150,58,0.6)', color: '#e8c479', fontSize: '10px', fontWeight: '700', letterSpacing: '0.6px', textTransform: 'uppercase', borderRadius: '999px', padding: '3px 10px' }}>
            Sponsor
          </div>
        </div>
        {!isNew && (
          <div style={{ display: 'flex', gap: '4px' }} className="dash-nav-desktop">
            {navViews.map(v => (
              <button key={v} onClick={() => setView(v)} style={{ background: view === v ? 'rgba(255,255,255,0.18)' : 'transparent', border: 'none', color: 'white', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: view === v ? '600' : '400' }}>
                {navLabel(v)}
              </button>
            ))}
            <button onClick={signOut} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px' }}>
              Sign out
            </button>
          </div>
        )}
        {isNew ? (
          <button onClick={signOut} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px' }}>
            Sign out
          </button>
        ) : (
          <button className="dash-nav-mobile" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '22px', cursor: 'pointer', padding: '4px 8px' }}>
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        )}
      </div>

      {mobileMenuOpen && !isNew && (
        <div style={{ background: PRIMARY, borderTop: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navViews.map(v => (
            <button key={v} onClick={() => { setView(v); setMobileMenuOpen(false) }}
              style={{ background: view === v ? 'rgba(255,255,255,0.18)' : 'transparent', border: 'none', color: 'white', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px', fontWeight: view === v ? '600' : '400', textAlign: 'left' as const }}>
              {navLabelMobile(v)}
            </button>
          ))}
          <button onClick={() => { signOut(); setMobileMenuOpen(false) }}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px', textAlign: 'left' as const, marginTop: '4px' }}>
            Sign out
          </button>
        </div>
      )}

      <style>{`
        .dash-nav-desktop { display: flex; }
        .dash-nav-mobile { display: none; }
        @media (max-width: 768px) {
          .dash-nav-desktop { display: none !important; }
          .dash-nav-mobile { display: block !important; }
        }
      `}</style>

      <div style={{ padding: '28px', maxWidth: '1080px', margin: '0 auto' }}>

        {/* DASHBOARD VIEW — Team-style activity, sponsored sign-ins only */}
        {view === 'dashboard' && !isNew && (
          <>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>Sponsorship activity</div>
            <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '16px' }}>
              Sign-ins across the agents you sponsor. You only see visitors whose sign-in consent named you — nothing from before a sponsorship began.
            </div>

            {activityLoading ? (
              <div style={{ color: '#6e6e73', fontSize: '14px', padding: '20px' }}>Loading activity…</div>
            ) : (
              <>
                {/* TOTALS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  {[
                    { label: 'Agents', value: totals.agents },
                    { label: 'Open Houses', value: totals.openHouses },
                    { label: 'Sign-ins', value: totals.visitors, accent: true },
                    { label: 'Verified at Door', value: totals.verified },
                  ].map(stat => (
                    <div key={stat.label} style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '16px 18px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{stat.label}</div>
                      <div style={{ fontSize: '28px', fontWeight: 600, color: stat.accent ? ACCENT : '#1d1d1f', letterSpacing: '-1px' }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* BY AGENT */}
                <div style={card}>
                  <div style={cardHeader}>By agent</div>
                  {agents.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#6e6e73', padding: '20px', fontSize: '13px' }}>
                      No agents yet — invite the agents you work with from the Agents tab.
                    </div>
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
                                  onClick={() => { setAgentFilter(agentFilter === a.id ? 'all' : a.id); setSelectedOH(null) }}
                                  style={{ background: agentFilter === a.id ? ACCENT : '#f5f5f7', color: agentFilter === a.id ? 'white' : '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '7px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}
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

                {/* OPEN HOUSES */}
                <div style={card}>
                  <div style={{ ...cardHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Open houses{agentFilter !== 'all' ? ' — filtered' : ''}</span>
                    {agentFilter !== 'all' && (
                      <button onClick={() => { setAgentFilter('all'); setSelectedOH(null) }} style={{ background: 'none', border: '1px solid #d1d1d6', color: '#6e6e73', borderRadius: '7px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Show all agents</button>
                    )}
                  </div>
                  {visibleOpenHouses.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#6e6e73', padding: '20px', fontSize: '13px' }}>No open houses yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                      {visibleOpenHouses.map(oh => (
                        <div key={oh.id} onClick={() => setSelectedOH(selectedOH?.id === oh.id ? null : oh)}
                          style={{ background: selectedOH?.id === oh.id ? '#f5f9ff' : 'white', border: `1px solid ${selectedOH?.id === oh.id ? ACCENT : '#d1d1d6'}`, borderRadius: '14px', padding: '12px 16px', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: oh.status === 'active' ? ACCENT : '#aeaeb2', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1d1d1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{oh.property_address}</div>
                              <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '2px' }}>
                                👤 {oh.agent_name}{oh.open_house_date ? ` · ${oh.open_house_date}` : ''}{oh.open_house_hours ? ` · ${oh.open_house_hours}` : ''}
                              </div>
                            </div>
                            <div style={{ fontSize: '12px', color: '#6e6e73', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              <strong style={{ color: '#1d1d1f' }}>{oh.visitor_count}</strong> sign-ins · {oh.verified_count} verified
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SIGN-IN LOG */}
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1d1d1f' }}>
                      {selectedOH ? (
                        <>Sign-ins — {selectedOH.property_address}<span style={{ color: '#6e6e73', fontWeight: 400 }}> · {selectedOH.agent_name}</span></>
                      ) : 'Recent sign-ins — all sponsored open houses'}
                    </div>
                    <button onClick={exportCSV} disabled={sortedVisitors.length === 0} style={{ background: PRIMARY, color: 'white', border: 'none', padding: '6px 13px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: sortedVisitors.length === 0 ? 'not-allowed' : 'pointer', opacity: sortedVisitors.length === 0 ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Export CSV</button>
                  </div>
                  {sortedVisitors.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#6e6e73', padding: '20px', fontSize: '13px' }}>
                      No sign-ins yet. Visitors appear here after they register at a sponsored agent&apos;s open house.
                    </div>
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
                              <td style={td}>{v.first_name} {v.last_name}</td>
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
                  <div style={{ fontSize: '11px', color: '#aeaeb2', marginTop: '10px', lineHeight: '1.5' }}>
                    Every visitor listed here agreed, at sign-in, to be contacted by you by name (phone, text, and email).
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* AGENTS VIEW */}
        {view === 'agents' && !isNew && (
          <>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>Agents you sponsor</div>
            <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '16px' }}>
              Invite an agent by the email they use for ohACCESS. Nothing appears on their open houses until they accept — and they keep full control of their own name, logo, and colors.
            </div>

            <div style={card}>
              <div style={{ ...cardHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Invite an agent</span>
                <span style={{ fontSize: '12px', fontWeight: 400, color: '#6e6e73' }}>
                  {agents.length + invites.length} of {seatLimit} seats used
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  type="email"
                  placeholder="agent@brokerage.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendInvite() }}
                />
                <button
                  onClick={sendInvite}
                  disabled={inviteBusy || !inviteEmail.trim()}
                  style={{ background: PRIMARY, color: 'white', border: 'none', borderRadius: '9px', padding: '10px 18px', fontSize: '13px', fontWeight: '600', cursor: inviteBusy ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: inviteBusy ? 0.7 : 1, whiteSpace: 'nowrap' as const }}
                >
                  {inviteBusy ? 'Sending...' : 'Send invite'}
                </button>
              </div>

              {invites.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>Pending invites</div>
                  {invites.map(inv => (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f5f5f7', border: '1px solid #e5e5ea', borderRadius: '9px', padding: '9px 12px', marginBottom: '6px' }}>
                      <div style={{ fontSize: '13px', color: '#1d1d1f' }}>{inv.email}</div>
                      <button onClick={() => revokeInvite(inv.id)} style={{ background: 'none', border: 'none', color: '#cc0000', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={card}>
              <div style={cardHeader}>Active sponsorships</div>
              {agents.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#aeaeb2', padding: '14px 0 4px' }}>No agents yet — invites you send will show up here once accepted.</div>
              ) : (
                <div style={{ marginTop: '12px' }}>
                  {agents.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f5f5f7', border: '1px solid #e5e5ea', borderRadius: '9px', padding: '9px 12px', marginBottom: '6px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f' }}>{a.full_name || a.email}</div>
                        <div style={{ fontSize: '11px', color: '#6e6e73' }}>{[a.brokerage, a.email].filter(Boolean).join(' · ')}</div>
                      </div>
                      {removeConfirm === a.id ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#6e6e73' }}>End sponsorship?</span>
                          <button onClick={() => removeAgent(a.id)} style={{ background: '#cc0000', color: 'white', border: 'none', borderRadius: '7px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Yes</button>
                          <button onClick={() => setRemoveConfirm(null)} style={{ background: 'none', border: 'none', color: '#6e6e73', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>No</button>
                        </div>
                      ) : (
                        <button onClick={() => setRemoveConfirm(a.id)} style={{ background: 'none', border: 'none', color: '#cc0000', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* SETTINGS VIEW (also the first-run setup) */}
        {view === 'settings' && (
          <div style={{ maxWidth: '640px' }}>
            {isNew ? (
              <>
                <div style={{ fontSize: '24px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>Welcome! Set up your sponsor card.</div>
                <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '16px' }}>
                  Fill in your card and save it — then invite the agents you work with. Once an agent accepts,
                  your card appears below theirs in every email their open-house visitors receive.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '24px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>Settings</div>
                <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '16px' }}>Your sponsor card — shown to open-house visitors in the &ldquo;Sponsored by&rdquo; section of their email.</div>
              </>
            )}

            <div style={card}>
              <div style={cardHeader}>Your sponsor card</div>
              <div style={{ fontSize: '12px', color: '#6e6e73', margin: '12px 0 16px', lineHeight: '1.5' }}>
                For photos, paste direct image URLs ending in .jpg or .png (right-click an image online and choose &ldquo;Copy Image Address&rdquo;).
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Full Name *</label>
                  <input style={inputStyle} type="text" placeholder="Mike Alden" value={sponsor?.full_name || ''} onChange={e => setSponsor({ ...sponsor, full_name: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Company</label>
                  <input style={inputStyle} type="text" placeholder="Summit Home Lending" value={sponsor?.company || ''} onChange={e => setSponsor({ ...sponsor, company: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Email (shown to visitors)</label>
                  <input style={inputStyle} type="email" placeholder="mike@summitlending.com" value={sponsor?.display_email || ''} onChange={e => setSponsor({ ...sponsor, display_email: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} type="tel" placeholder="(214) 555-0182" value={sponsor?.phone || ''} onChange={e => setSponsor({ ...sponsor, phone: formatPhone(e.target.value) })} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>License Number</label>
                  <input style={inputStyle} type="text" placeholder="NMLS #123456" value={sponsor?.license_number || ''} onChange={e => setSponsor({ ...sponsor, license_number: e.target.value })} />
                  <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '4px' }}>Include the license type, e.g. &ldquo;NMLS #123456&rdquo;.</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Landing Page URL</label>
                  <input style={inputStyle} type="url" placeholder="https://yourwebsite.com/about" value={sponsor?.landing_page_url || ''} onChange={e => setSponsor({ ...sponsor, landing_page_url: e.target.value })} />
                  <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '4px' }}>Your bio page or website. Appears as a &ldquo;Sponsor information&rdquo; link on your card in visitor emails.</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Headshot URL</label>
                  <input style={inputStyle} type="url" placeholder="https://yoursite.com/headshot.jpg" value={sponsor?.headshot_url || ''} onChange={e => setSponsor({ ...sponsor, headshot_url: e.target.value })} />
                  {sponsor?.headshot_url && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={sponsor.headshot_url} alt="Headshot" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #d1d1d6' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      <span style={{ fontSize: '11px', color: '#30d158', fontWeight: '600' }}>✓ Preview loaded</span>
                    </div>
                  )}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Logo URL</label>
                  <input style={inputStyle} type="url" placeholder="https://yoursite.com/logo.png" value={sponsor?.logo_url || ''} onChange={e => setSponsor({ ...sponsor, logo_url: e.target.value })} />
                  <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '4px' }}>A logo with a transparent or white background looks best in emails.</div>
                  {sponsor?.logo_url && (
                    <div style={{ marginTop: '8px', background: '#f5f5f7', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '52px', border: '1px solid #d1d1d6' }}>
                      <img src={sponsor.logo_url} alt="Logo preview" style={{ maxHeight: '72px', maxWidth: '180px', objectFit: 'contain', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={saveProfile}
                disabled={saving}
                style={{ marginTop: '18px', width: '100%', background: PRIMARY, color: 'white', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Saving...' : isNew ? 'Create sponsor profile →' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? '#cc0000' : '#1d1d1f', color: 'white', borderRadius: '12px', padding: '12px 20px', fontSize: '13px', fontWeight: '600', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 100, maxWidth: '90vw', textAlign: 'center' as const }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
