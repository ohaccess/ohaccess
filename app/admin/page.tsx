'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import { deviceLabel } from '@/lib/ua-label'
import { IMPERSONATION_KEY } from '../_components/ImpersonationBanner'
import { timelineRank } from '@/lib/timeline'
import { useSortable, applySort, type SortState, type Sortable } from '@/lib/sort'
import OpenHouseMap from '@/app/_components/OpenHouseMap'

type Stats = {
  totalAgents: number
  payingAgents: number
  freeAgents: number
  doubleBilled: number
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
  phone: string
  brokerage: string
  tier: string
  role: string
  subscription_status: string
  billing_interval: string
  current_period_end: string | null
  bonus_visitors: number
  referral_source: string
  comped: boolean
  created_at: string
  last_sign_in_at: string | null
  openHouseCount: number
  visitorCount: number
  doubleBilling: boolean
  onFreeTrial: boolean
  trialUsed: number
  trialLimit: number
  trialLocked: boolean
  canceling: boolean
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
  when: 'past' | 'current' | 'future'
  isPast: boolean
  visitorCount: number
  legalHold: boolean
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

type WindowCounts = { lifetime: number; last12mo: number; last30d: number }

type AbandonedScan = {
  scanned_at: string
  openHouseAddress: string
  agentName: string
  ip_address: string
  user_agent: string
}

type Funnel = {
  openHousesCreated: WindowCounts
  visitorsLogged: WindowCounts
  scans: WindowCounts
  conversionPct30d: number | null
  abandonedScans: AbandonedScan[]
}

type Revenue = {
  mrrCents: number
  activeSubs: number
  newMrrCents30d: number
  cancelingCount: number
  cancelingMrrCents: number
}

type Payload = {
  stats: Stats
  funnel?: Funnel
  revenue?: Revenue | null
  agents: Agent[]
  openHouses: OpenHouse[]
  visitors: Visitor[]
  generatedAt: string
}

type Tab = 'overview' | 'agents' | 'openhouses' | 'visitors' | 'map'
type OHFilter = 'all' | 'live' | 'upcoming' | 'past'

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
const fmtUsd = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

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

  // Gifts — the manual reward behind the referral program: bonus trial
  // visitors, or free Pro until a date. Paying subscribers get gifted via the
  // Stripe dashboard instead (the API refuses them with a pointer there).
  const [giftingId, setGiftingId] = useState<string | null>(null)

  const gift = async (agent: Agent) => {
    const choice = window.prompt(
      `Gift for ${agent.name}:\n\n` +
        `1 = Bonus trial visitors (raises their free-trial cap)\n` +
        `2 = Free Pro until a date\n\nType 1 or 2:`
    )
    if (choice == null) return
    let payload: { userId: string; action: string; amount?: number; until?: string }
    let confirmMsg: string
    if (choice.trim() === '1') {
      const raw = window.prompt(
        `How many bonus visitors for ${agent.name}?\n\n` +
          `They currently have ${agent.bonus_visitors} bonus on top of the standard 25. ` +
          `Enter a negative number to take some back.`,
        '25'
      )
      if (raw == null) return
      const amount = Number(raw)
      if (!Number.isInteger(amount) || amount === 0) {
        window.alert('Enter a whole number, like 25.')
        return
      }
      payload = { userId: agent.id, action: 'visitors', amount }
      confirmMsg =
        amount > 0
          ? `Give ${agent.name} ${amount} bonus visitor registration(s)?\n\nTheir free-trial cap becomes ${25 + agent.bonus_visitors + amount}.`
          : `Remove ${-amount} bonus visitor registration(s) from ${agent.name}?`
    } else if (choice.trim() === '2') {
      const suggested = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const raw = window.prompt(`Free Pro for ${agent.name} until what date? (YYYY-MM-DD)`, suggested)
      if (raw == null) return
      if (Number.isNaN(Date.parse(raw.trim()))) {
        window.alert('Enter a date like 2026-08-05.')
        return
      }
      payload = { userId: agent.id, action: 'comp', until: raw.trim() }
      confirmMsg =
        `Gift ${agent.name} free Pro until ${raw.trim()}?\n\n` +
        `Full Pro access, no card needed. When the date passes they drop back to the free trial automatically (their data is untouched).`
    } else {
      window.alert('Type 1 or 2.')
      return
    }
    if (!window.confirm(confirmMsg)) return
    setGiftingId(agent.id)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/login'
      return
    }
    const res = await fetch('/api/admin/gift', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      window.alert(`Could not gift: ${j.error || res.status}`)
      setGiftingId(null)
      return
    }
    window.alert(
      payload.action === 'visitors'
        ? `Done — ${j.name} now has ${j.bonusVisitors} bonus visitor(s) (trial cap: ${j.trialLimit}).`
        : `Done — ${j.name} has free Pro until ${new Date(j.until).toLocaleDateString()}.`
    )
    setGiftingId(null)
    refresh()
  }

  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const resolveDoubleBilling = async (agent: Agent) => {
    if (
      !window.confirm(
        `Stop double-charging ${agent.name}?\n\n` +
          `They're on team "${agent.brokerage}", which covers them, but they still have an active personal subscription. ` +
          `This schedules their personal subscription to cancel at period end (they keep what they already paid for; it just won't renew). ` +
          `They stay on the team the whole time.`
      )
    )
      return
    setResolvingId(agent.id)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/login'
      return
    }
    const res = await fetch('/api/admin/resolve-double-billing', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: agent.id }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      window.alert(`Could not resolve double-billing: ${j.error || res.status}`)
      setResolvingId(null)
      return
    }
    const d = await res.json()
    window.alert(
      d.canceled > 0
        ? `Done — ${d.canceled} personal subscription(s) for ${d.name} will cancel at period end.`
        : `No active personal subscription found for ${d.name} — nothing to cancel.`
    )
    setResolvingId(null)
    refresh()
  }

  // Provision an invoice-based brokerage (100+/custom deals) without touching
  // Supabase Studio. Payment stays manual (Stripe invoice from the dashboard).
  const [provEmail, setProvEmail] = useState('')
  const [provName, setProvName] = useState('')
  const [provSeats, setProvSeats] = useState('')
  const [provBusy, setProvBusy] = useState(false)

  const provisionBrokerage = async () => {
    const seats = Number(provSeats)
    if (!provEmail.trim() || !Number.isInteger(seats) || seats < 1) {
      window.alert('Enter the owner\'s account email and a whole-number seat limit.')
      return
    }
    if (
      !window.confirm(
        `Provision an invoice-based brokerage?\n\n` +
          `Owner: ${provEmail.trim()}\n` +
          `Seats: ${seats}\n` +
          (provName.trim() ? `Name: ${provName.trim()}\n` : '') +
          `\nThey become a brokerage admin immediately. Billing stays manual (send a Stripe invoice separately).`
      )
    )
      return
    setProvBusy(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/login'
      return
    }
    const res = await fetch('/api/admin/provision-brokerage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ownerEmail: provEmail.trim(), seatLimit: seats, name: provName.trim() || undefined }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      window.alert(`Could not provision: ${j.error || res.status}`)
      setProvBusy(false)
      return
    }
    window.alert(`Done — ${provEmail.trim()} is now a brokerage admin with ${seats} seats.`)
    setProvEmail(''); setProvName(''); setProvSeats('')
    setProvBusy(false)
    refresh()
  }

  // Demo QR redirects — printed QR signs (ohaccess.com/r/demo, /demo1, …)
  // that can each be repointed at a different open house, so several signs
  // can be out at once on a multi-stop demo day.
  type DemoRow = { input: string; current: string | null; clicks: number }
  const [demoRows, setDemoRows] = useState<Record<string, DemoRow>>({})
  const [demoBusyCode, setDemoBusyCode] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/admin/demo-redirect', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok || cancelled) return
      const j = await res.json()
      if (cancelled) return
      const rows: Record<string, DemoRow> = {}
      for (const c of j.codes || []) {
        rows[c.code] = { input: c.destinationUrl || '', current: c.destinationUrl, clicks: c.clicks || 0 }
      }
      setDemoRows(rows)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const saveDemoRedirect = async (code: string) => {
    const url = (demoRows[code]?.input || '').trim()
    if (!/^https?:\/\//i.test(url)) {
      window.alert('Paste the full open house link — it starts with https://')
      return
    }
    setDemoBusyCode(code)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/login'
      return
    }
    const res = await fetch('/api/admin/demo-redirect', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, destinationUrl: url }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      window.alert(`Could not update the demo QR: ${j.error || res.status}`)
      setDemoBusyCode(null)
      return
    }
    setDemoRows((rows) => ({ ...rows, [code]: { ...rows[code], current: url } }))
    setDemoBusyCode(null)
  }

  const downloadDemoQr = async (code: string) => {
    const res = await fetch(`/api/qrcode?url=${encodeURIComponent(`https://ohaccess.com/r/${code}`)}`)
    if (!res.ok) {
      window.alert('Could not generate the QR image.')
      return
    }
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = `ohaccess-demo-qr-${code}.png`
    a.click()
    URL.revokeObjectURL(objectUrl)
  }

  const [deletingOHId, setDeletingOHId] = useState<string | null>(null)
  const [holdingOHId, setHoldingOHId] = useState<string | null>(null)

  // Preservation hold (migrations 041/042). Placing one exempts this open
  // house's visitors, archived records and scan log from every automated
  // purge and blocks the admin hard-deletes until it's released.
  const toggleLegalHold = async (oh: OpenHouse) => {
    const releasing = oh.legalHold

    let reference = ''
    let requestedBy = ''
    let note = ''

    if (releasing) {
      note =
        window.prompt(
          `RELEASE the legal hold on "${oh.address}"?\n\n` +
            `Records go back on the normal 3-year clock. Anything already past ` +
            `that date is permanently deleted on the next monthly purge — this ` +
            `cannot be undone.\n\n` +
            `Only release when counsel confirms the matter is closed.\n\n` +
            `Who confirmed it, and when?`
        ) || ''
      if (!note.trim()) return
    } else {
      reference =
        window.prompt(
          `Place a legal hold on "${oh.address}"?\n\n` +
            `Its ${oh.visitorCount} visitor record(s), any archived records and ` +
            `the scan log are exempted from deletion until released.\n\n` +
            `Matter or case reference (e.g. "APD 2026-114377"):`
        ) || ''
      if (!reference.trim()) return
      requestedBy = window.prompt('Requesting agency, department or law firm (optional):') || ''
      note = window.prompt('What is being preserved, and why? (one line)') || ''
      if (!note.trim()) return
    }

    setHoldingOHId(oh.id)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/login'
      return
    }
    const res = await fetch('/api/admin/legal-hold', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        openHouseId: oh.id,
        action: releasing ? 'release' : 'place',
        reference,
        requestedBy,
        note,
      }),
    })
    const j = await res.json().catch(() => ({}))
    setHoldingOHId(null)
    if (!res.ok) {
      window.alert(`Could not ${releasing ? 'release' : 'place'} the hold: ${j.error || res.status}`)
      return
    }
    if (j.warning) {
      window.alert(`⚠️ ${j.warning}`)
    } else if (releasing) {
      window.alert(`Hold released on "${oh.address}".`)
    } else {
      const c = j.counts || {}
      window.alert(
        `Hold placed on "${oh.address}".\n\n` +
          `${c.visitors || 0} visitor record(s), ${c.visitor_archive || 0} archived ` +
          `record(s) and ${c.qr_scans || 0} scan log entr(ies) are now exempt from ` +
          `deletion.`
      )
    }
    refresh()
  }

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

  // Phone search matches on digits so "(817) 555-1234", "817-555-1234", and
  // "8175551234" all find the same agent.
  const qDigits = q.replace(/\D/g, '')
  const filteredAgents = useMemo(() => {
    if (!data) return []
    return data.agents.filter(
      (a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (qDigits.length >= 4 && a.phone.replace(/\D/g, '').includes(qDigits)) ||
        a.brokerage.toLowerCase().includes(q) ||
        a.referral_source.toLowerCase().includes(q)
    )
  }, [data, q])

  const filteredOpenHouses = useMemo(() => {
    if (!data) return []
    return data.openHouses
      .filter((o) =>
        ohFilter === 'all' ? true :
        ohFilter === 'live' ? o.when === 'current' :
        ohFilter === 'upcoming' ? o.when === 'future' :
        o.when === 'past'
      )
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
            {data.revenue ? (
              <Kpi
                label="Monthly Revenue"
                value={fmtUsd(data.revenue.mrrCents)}
                sub={`${data.revenue.activeSubs} paid subscription${data.revenue.activeSubs === 1 ? '' : 's'} · +${fmtUsd(data.revenue.newMrrCents30d)}/mo added in 30 days`}
                accent={GREEN}
              />
            ) : (
              <Kpi label="Monthly Revenue" value="—" sub="Couldn't reach Stripe — try Refresh" />
            )}
            {data.revenue && data.revenue.cancelingCount > 0 && (
              <Kpi
                label="Leaving Soon"
                value={data.revenue.cancelingCount}
                sub={`−${fmtUsd(data.revenue.cancelingMrrCents)}/mo when they lapse`}
                accent="#cc0000"
              />
            )}
            <Kpi label="Agents Signed Up" value={data.stats.totalAgents} sub={`+${data.stats.newAgentsThisWeek} this week`} />
            <Kpi label="Paying Agents" value={data.stats.payingAgents} sub={`${data.stats.freeAgents} free`} accent={GREEN} />
            {data.stats.doubleBilled > 0 && (
              <Kpi
                label="Double-billed"
                value={data.stats.doubleBilled}
                sub="on a team + paying personally"
                accent="#cc0000"
              />
            )}
            <Kpi label="Open Houses" value={data.stats.totalOpenHouses} sub={`${data.stats.upcomingOpenHouses} live/upcoming · ${data.stats.pastOpenHouses} past`} />
            <Kpi label="Total Visitors" value={data.stats.totalVisitors} sub={`+${data.stats.visitorsThisWeek} this week`} accent={BLUE} />
            <Kpi label="Verified Visitors" value={data.stats.verifiedVisitors} sub={`${data.stats.totalVisitors - data.stats.verifiedVisitors} unverified`} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginTop: 28, borderBottom: `1px solid ${BORDER}` }}>
            <TabButton id="overview" tab={tab} setTab={selectTab} label="Overview" />
            <TabButton id="agents" tab={tab} setTab={selectTab} label={`Agents (${data.agents.length})`} />
            <TabButton id="openhouses" tab={tab} setTab={selectTab} label={`Open Houses (${data.openHouses.length})`} />
            <TabButton id="visitors" tab={tab} setTab={selectTab} label={`Visitors (${data.visitors.length})`} />
            <TabButton id="map" tab={tab} setTab={selectTab} label={`Map (${data.stats.totalOpenHouses})`} />
          </div>

          {/* Controls row (search + filters + export) — not for the map tab */}
          {tab !== 'overview' && tab !== 'map' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0', flexWrap: 'wrap' }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tab === 'agents'
                    ? 'Search name, email, brokerage…'
                    : tab === 'openhouses'
                    ? 'Search address, agent, codeword…'
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
                  {(['all', 'live', 'upcoming', 'past'] as OHFilter[]).map((f) => (
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
          {tab === 'overview' && (
            <>
              <Overview data={data} setTab={selectTab} />
              {/* Provision brokerage — invoice-based 100+/custom deals. Self-serve
                  (11–100 seats) never needs this; it exists so big negotiated deals
                  don't require hand-editing Supabase Studio. */}
              <div style={{ background: 'white', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px', marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 4 }}>Provision invoice-based brokerage</div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>
                  For negotiated 100+ deals paid by invoice. The owner must already have an ohACCESS account. Billing stays manual — send them a Stripe invoice separately.
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={provEmail} onChange={(e) => setProvEmail(e.target.value)} placeholder="owner@brokerage.com"
                    style={{ flex: '1 1 220px', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }} />
                  <input value={provName} onChange={(e) => setProvName(e.target.value)} placeholder="Brokerage name (optional)"
                    style={{ flex: '1 1 180px', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }} />
                  <input value={provSeats} onChange={(e) => setProvSeats(e.target.value)} placeholder="Seats" inputMode="numeric"
                    style={{ width: 80, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }} />
                  <button onClick={provisionBrokerage} disabled={provBusy}
                    style={{ background: INK, color: 'white', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: provBusy ? 0.6 : 1 }}>
                    {provBusy ? 'Provisioning…' : 'Provision →'}
                  </button>
                </div>
              </div>
              {/* Demo QR redirects — each printed demo sign encodes /r/<code>
                  once; each row repoints one sign at whatever open house was
                  just set up in front of a prospect. */}
              <div style={{ background: 'white', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px', marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 4 }}>Demo QR codes</div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>
                  Each printed demo sign encodes its own permanent link (
                  <code style={{ background: '#f5f5f7', padding: '2px 6px', borderRadius: 4 }}>ohaccess.com/r/demo</code>, <code style={{ background: '#f5f5f7', padding: '2px 6px', borderRadius: 4 }}>/r/demo1</code>, …)
                  — paste an open house link next to a sign and that sign points there instantly.
                </div>
                {Object.keys(demoRows).length === 0 && <div style={{ fontSize: 13, color: SUB }}>Loading…</div>}
                {Object.entries(demoRows).map(([code, row]) => (
                  <div key={code} style={{ padding: '10px 0', borderTop: `1px solid #f0f0f2` }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <code style={{ background: '#f5f5f7', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, minWidth: 62, textAlign: 'center' }}>/r/{code}</code>
                      <input value={row.input}
                        onChange={(e) => setDemoRows((rows) => ({ ...rows, [code]: { ...rows[code], input: e.target.value } }))}
                        placeholder="https://ohaccess.com/register/…"
                        style={{ flex: '1 1 280px', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }} />
                      <button onClick={() => saveDemoRedirect(code)} disabled={demoBusyCode === code}
                        style={{ background: INK, color: 'white', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: demoBusyCode === code ? 0.6 : 1 }}>
                        {demoBusyCode === code ? 'Saving…' : row.current ? 'Update →' : 'Set →'}
                      </button>
                      <button onClick={() => downloadDemoQr(code)}
                        style={{ background: '#f5f5f7', color: INK, border: '1px solid #d1d1d6', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Download QR
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: SUB, marginTop: 6, paddingLeft: 2 }}>
                      {row.current ? (
                        <>
                          Pointing at:{' '}
                          <a href={row.current} target="_blank" rel="noreferrer" style={{ color: BLUE, wordBreak: 'break-all' }}>{row.current}</a>
                          {row.clicks > 0 && <span style={{ marginLeft: 8 }}>· scanned {row.clicks.toLocaleString()} time{row.clicks === 1 ? '' : 's'}</span>}
                        </>
                      ) : (
                        'Not set — scans land on the ohaccess.com homepage.'
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === 'agents' && (
            <AgentsTable
              rows={filteredAgents}
              onImpersonate={impersonate}
              impersonatingId={impersonatingId}
              onDelete={deleteAccount}
              deletingId={deletingId}
              onResolveDoubleBilling={resolveDoubleBilling}
              resolvingId={resolvingId}
              onGift={gift}
              giftingId={giftingId}
            />
          )}
          {tab === 'openhouses' && (
            <OpenHousesTable
              rows={filteredOpenHouses}
              onDelete={deleteOpenHouse}
              deletingId={deletingOHId}
              onToggleHold={toggleLegalHold}
              holdingId={holdingOHId}
            />
          )}
          {tab === 'visitors' && <VisitorsTable rows={filteredVisitors} />}

          {tab === 'map' && (
            <OpenHouseMap
              onViewAgent={(agent) => {
                setTab('agents')
                // The pin shows the agent's PUBLIC display email, which can
                // differ from the login email the Agents table carries — so
                // resolve by id to the login email the search will match.
                // Fallbacks (phone digits, then name) cover odd data.
                const match = data.agents.find((a) => a.id === agent.id)
                setQuery(match?.email || agent.phone.replace(/\D/g, '') || agent.name)
              }}
            />
          )}
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
      ['Name', 'Email', 'Brokerage', 'Tier', 'Role', 'Subscription', 'Billing', 'Trial', 'Open Houses', 'Visitors', 'Last Login', 'Joined'],
      agents.map((a) => [
        a.name,
        a.email,
        a.brokerage,
        a.tier,
        a.role,
        a.subscription_status,
        a.billing_interval,
        a.onFreeTrial ? `${a.trialUsed}/${a.trialLimit}${a.trialLocked ? ' (locked)' : ''}` : '',
        a.openHouseCount,
        a.visitorCount,
        fmtLogin(a.last_sign_in_at),
        fmtDate(a.created_at),
      ])
    )
  } else if (tab === 'openhouses') {
    downloadCSV(
      'ohaccess-open-houses.csv',
      ['Address', 'Agent', 'When', 'Hours', 'Status', 'Codeword', 'Price', 'Visitors', 'Created'],
      openHouses.map((o) => [
        o.address,
        o.agentName,
        o.start_at ? fmtDateTime(o.start_at) : o.open_house_date,
        o.open_house_hours,
        o.when === 'current' ? 'Live now' : o.when === 'future' ? 'Upcoming' : 'Past',
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

function Kpi({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div style={{ padding: '16px 18px', background: '#f5f5f7', borderRadius: 14 }}>
      <div style={{ fontSize: 11, color: SUB, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent || INK, marginTop: 6, lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
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
const th: React.CSSProperties = { padding: '11px 12px', fontWeight: 700, color: INK, fontSize: 12, textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 12px', color: INK, fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const tdSub: React.CSSProperties = { ...td, color: SUB }
// Skinny variants for count-style columns so the agents table fits without
// a horizontal scrollbar.
const tdNarrow: React.CSSProperties = { ...td, padding: '11px 8px' }
const tdRNarrow: React.CSSProperties = { ...tdR, padding: '11px 8px' }

// ---- sorting ---- (hook + comparator shared with the dashboard)

function SortTh({
  label,
  k,
  state,
  onSort,
  align,
  narrow,
}: {
  label: string
  k: string
  state: SortState
  onSort: (k: string) => void
  align?: 'right'
  narrow?: boolean
}) {
  const active = state.key === k
  return (
    <th
      onClick={() => onSort(k)}
      style={{
        ...(align === 'right' ? thR : th),
        ...(narrow ? { padding: '11px 8px', whiteSpace: 'normal', lineHeight: 1.15 } : {}),
        cursor: 'pointer',
        userSelect: 'none',
      }}
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
  // Paid agents (no cap) sort below every trial account; locked accounts top.
  trial: (a) => (a.onFreeTrial ? (a.trialLocked ? 2 : a.trialUsed / Math.max(1, a.trialLimit)) : -1),
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
  onResolveDoubleBilling,
  resolvingId,
  onGift,
  giftingId,
}: {
  rows: Agent[]
  onImpersonate: (a: Agent) => void
  impersonatingId: string | null
  onDelete: (a: Agent) => void
  deletingId: string | null
  onResolveDoubleBilling: (a: Agent) => void
  resolvingId: string | null
  onGift: (a: Agent) => void
  giftingId: string | null
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
          <SortTh label="Trial" k="trial" state={state} onSort={onSort} narrow />
          <SortTh label="Open Houses" k="openHouseCount" state={state} onSort={onSort} align="right" narrow />
          <SortTh label="Visitors" k="visitorCount" state={state} onSort={onSort} align="right" narrow />
          <SortTh label="Last Login" k="lastLogin" state={state} onSort={onSort} />
          <SortTh label="Joined" k="joined" state={state} onSort={onSort} />
          <th style={thR}></th>
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 && <EmptyRow span={9} text="No agents match." />}
        {sorted.map((a) => (
          <tr key={a.id} style={{ borderTop: `1px solid ${BORDER}` }}>
            <td style={td}>
              <div style={{ fontWeight: 600 }}>{a.name}</div>
              <div style={{ fontSize: 12, color: SUB }}>{a.email}</div>
              {a.referral_source && (
                <div style={{ fontSize: 11, color: SUB }} title="Signed up via this ?ref= link">
                  ref: <span style={{ fontFamily: 'monospace' }}>{a.referral_source}</span>
                </div>
              )}
            </td>
            <td style={tdSub}>{a.brokerage || '—'}{a.role === 'brokerage_admin' ? ' (admin)' : ''}</td>
            <td style={td}>
              {tierBadge(a.tier, a.subscription_status)}
              {a.comped && (
                <span
                  title={`Gifted (comped) access — no card on file${a.current_period_end ? `, until ${fmtDate(a.current_period_end)}` : ''}`}
                  style={{ display: 'inline-block', marginLeft: 6, background: '#f3ecff', color: '#6b3fd4', border: '1px solid #ddd0f5', borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  🎁 gifted{a.current_period_end ? ` → ${fmtDate(a.current_period_end)}` : ''}
                </span>
              )}
              {a.bonus_visitors > 0 && (
                <span
                  title={`${a.bonus_visitors} bonus trial visitors gifted — their free-trial cap is ${25 + a.bonus_visitors}`}
                  style={{ display: 'inline-block', marginLeft: 6, background: '#eef6ff', color: '#0b5cad', border: '1px solid #cfe5fa', borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  +{a.bonus_visitors} visitors
                </span>
              )}
              {a.doubleBilling && (
                <span
                  title="On a team AND still paying for a personal subscription — being double-charged."
                  style={{
                    display: 'inline-block',
                    marginLeft: 6,
                    background: '#fff0f0',
                    color: '#cc0000',
                    border: '1px solid #f0c0c0',
                    borderRadius: 6,
                    padding: '1px 6px',
                    fontSize: 10,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  ⚠ Double-billed
                </span>
              )}
              {a.canceling && (
                <span
                  title="Subscription canceled — paid access continues until this date, then they drop to free."
                  style={{
                    display: 'inline-block',
                    marginLeft: 6,
                    background: '#fff3e0',
                    color: AMBER,
                    border: '1px solid #f0dcc0',
                    borderRadius: 6,
                    padding: '1px 6px',
                    fontSize: 10,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {`⏳ ends ${fmtDate(a.current_period_end)}`}
                </span>
              )}
            </td>
            <td
              style={tdNarrow}
              title={
                a.trialLocked
                  ? 'Trial cap reached — registration is locked until they subscribe'
                  : 'Free-trial visitor registrations used vs their cap'
              }
            >
              {!a.onFreeTrial ? (
                <span style={{ color: '#c7c7cc' }}>—</span>
              ) : a.trialLocked ? (
                <Badge text={`🔒 ${a.trialUsed}/${a.trialLimit}`} color="#cc0000" bg="#fff0f0" />
              ) : (
                <span
                  style={{
                    color: a.trialUsed / Math.max(1, a.trialLimit) >= 0.6 ? AMBER : SUB,
                    fontWeight: a.trialUsed / Math.max(1, a.trialLimit) >= 0.6 ? 700 : 400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {`${a.trialUsed}/${a.trialLimit}`}
                </span>
              )}
            </td>
            <td style={tdRNarrow}>{a.openHouseCount}</td>
            <td style={tdRNarrow}>{a.visitorCount}</td>
            <td style={tdSub}>{fmtLogin(a.last_sign_in_at)}</td>
            <td style={tdSub}>{fmtDate(a.created_at)}</td>
            <td style={{ ...tdR, whiteSpace: 'nowrap' }}>
              <div style={{ display: 'inline-flex', gap: 6 }}>
                {a.doubleBilling && (
                  <button
                    onClick={() => onResolveDoubleBilling(a)}
                    disabled={resolvingId === a.id}
                    style={{
                      background: '#cc0000',
                      color: 'white',
                      border: '1px solid #cc0000',
                      borderRadius: 8,
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: resolvingId === a.id ? 'default' : 'pointer',
                      opacity: resolvingId === a.id ? 0.6 : 1,
                    }}
                  >
                    {resolvingId === a.id ? 'Resolving…' : 'Stop double-charge'}
                  </button>
                )}
                <button
                  onClick={() => onGift(a)}
                  disabled={giftingId === a.id}
                  style={{
                    background: 'white',
                    color: '#6b3fd4',
                    border: '1px solid #ddd0f5',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: giftingId === a.id ? 'default' : 'pointer',
                    opacity: giftingId === a.id ? 0.6 : 1,
                  }}
                >
                  {giftingId === a.id ? 'Gifting…' : '🎁 Gift'}
                </button>
                <button
                  onClick={() => onImpersonate(a)}
                  disabled={impersonatingId === a.id || deletingId === a.id}
                  style={{
                    background: '#f5f5f7',
                    color: INK,
                    border: '1px solid #d1d1d6',
                    borderRadius: 8,
                    padding: '6px 10px',
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
                    padding: '6px 10px',
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
  status: (o) => (o.when === 'current' ? 0 : o.when === 'future' ? 1 : 2),
  code_word: (o) => o.code_word,
  visitorCount: (o) => o.visitorCount,
}

function OpenHousesTable({
  rows,
  onDelete,
  deletingId,
  onToggleHold,
  holdingId,
}: {
  rows: OpenHouse[]
  onDelete: (o: OpenHouse) => void
  deletingId: string | null
  onToggleHold: (o: OpenHouse) => void
  holdingId: string | null
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
          <SortTh label="Codeword" k="code_word" state={state} onSort={onSort} />
          <SortTh label="Visitors" k="visitorCount" state={state} onSort={onSort} align="right" />
          <th style={thR}></th>
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 && <EmptyRow span={7} text="No open houses match." />}
        {sorted.map((o) => (
          <tr key={o.id} style={{ borderTop: `1px solid ${BORDER}` }}>
            <td style={td}>
              <div style={{ fontWeight: 600 }}>
                {o.address}
                {o.legalHold && (
                  <span style={{ marginLeft: 8, verticalAlign: 'middle' }}>
                    <Badge text="On legal hold" color="#8a5a00" bg="#fdf0d5" />
                  </span>
                )}
              </div>
              {o.listing_price && <div style={{ fontSize: 12, color: SUB }}>{o.listing_price}</div>}
            </td>
            <td style={tdSub}>{o.agentName}</td>
            <td style={td}>
              <div>{o.start_at ? `${fmtDateTime(o.start_at)}${o.end_at ? ` – ${fmtTime(o.end_at)}` : ''}` : o.open_house_date || '—'}</div>
              {o.open_house_hours && !o.start_at && <div style={{ fontSize: 12, color: SUB }}>{o.open_house_hours}</div>}
            </td>
            <td style={td}>
              {o.when === 'current' ? (
                <Badge text="Live now" color={GREEN} bg="#e6f6ec" />
              ) : o.when === 'future' ? (
                <Badge text="Upcoming" color={BLUE} bg="#e8f1fd" />
              ) : (
                <Badge text="Past" color={SUB} bg="#f0f0f2" />
              )}
            </td>
            <td style={{ ...td, fontFamily: 'monospace' }}>{o.code_word || '—'}</td>
            <td style={tdR}>{o.visitorCount}</td>
            <td style={{ ...tdR, whiteSpace: 'nowrap' }}>
              <button
                onClick={() => onToggleHold(o)}
                disabled={holdingId === o.id}
                title={
                  o.legalHold
                    ? 'Release the preservation hold — records return to the normal 3-year clock'
                    : 'Exempt this open house from deletion pending an investigation'
                }
                style={{
                  background: o.legalHold ? '#fdf0d5' : 'white',
                  color: '#8a5a00',
                  border: '1px solid #e5cf9e',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: holdingId === o.id ? 'default' : 'pointer',
                  opacity: holdingId === o.id ? 0.6 : 1,
                  marginRight: 8,
                }}
              >
                {holdingId === o.id ? 'Working…' : o.legalHold ? 'Release hold' : 'Legal hold'}
              </button>
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

const V_ACC: Record<string, (v: Visitor) => Sortable> = {
  name: (v) => v.name,
  contact: (v) => v.email,
  timeline: (v) => timelineRank(v.purchasing_timeline),
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

  // Paying agents whose subscription is scheduled to cancel — still active
  // today, gone at period end. Soonest departure first.
  const cancelingAgents = [...data.agents]
    .filter((a) => a.canceling)
    .sort((a, b) => (a.current_period_end || '').localeCompare(b.current_period_end || ''))
    .slice(0, 8)

  // Free-trial agents at 60%+ of their cap — the upgrade-prospect /
  // about-to-hit-the-wall list. Locked accounts sort to the top.
  const nearCap = [...data.agents]
    .filter((a) => a.onFreeTrial && a.trialLimit > 0 && a.trialUsed / a.trialLimit >= 0.6)
    .sort((a, b) => b.trialUsed / b.trialLimit - a.trialUsed / a.trialLimit)
    .slice(0, 8)

  // Stuck signups (agents arrive newest-first from the API, so these are too).
  const neverLoggedIn = data.agents.filter((a) => !a.last_sign_in_at)
  const noOpenHouse = data.agents.filter((a) => a.last_sign_in_at && a.openHouseCount === 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 24 }}>
      <Panel title="Subscriptions Ending" onMore={cancelingAgents.length > 0 ? () => setTab('agents') : undefined}>
        {cancelingAgents.length === 0 && <Muted>No subscriptions are set to cancel.</Muted>}
        {cancelingAgents.map((a) => (
          <Line
            key={a.id}
            left={a.name}
            sub={`${a.tier}${a.billing_interval ? ` · ${a.billing_interval === 'two_year_prepay' ? '2-year' : a.billing_interval}ly` : ''} · ${a.email}`}
            right={`ends ${fmtDate(a.current_period_end)}`}
          />
        ))}
      </Panel>

      <Panel title="Near Trial Cap" onMore={nearCap.length > 0 ? () => setTab('agents') : undefined}>
        {nearCap.length === 0 && <Muted>No free agent is close to their trial cap yet.</Muted>}
        {nearCap.map((a) => (
          <Line
            key={a.id}
            left={a.name}
            sub={a.email}
            right={
              a.trialLocked ? (
                <Badge text={`Locked · ${a.trialUsed} / ${a.trialLimit}`} color="#cc0000" bg="#fff0f0" />
              ) : (
                `${a.trialUsed} / ${a.trialLimit} visitors`
              )
            }
          />
        ))}
        {nearCap.length > 0 && (
          <div style={{ fontSize: 11, color: SUB, paddingTop: 8 }}>
            Free agents at 60%+ of their visitor cap — the ones worth a personal upgrade nudge.
          </div>
        )}
      </Panel>

      <Panel title="Needs Attention" onMore={() => setTab('agents')}>
        {neverLoggedIn.length === 0 && noOpenHouse.length === 0 && (
          <Muted>Everyone who signed up has logged in and created an open house.</Muted>
        )}
        {neverLoggedIn.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: AMBER, paddingTop: 4 }}>
              {`Signed up, never logged in (${neverLoggedIn.length})`}
            </div>
            {neverLoggedIn.slice(0, 5).map((a) => (
              <Line key={a.id} left={a.name} sub={a.email} right={`joined ${fmtDate(a.created_at)}`} />
            ))}
            <div style={{ fontSize: 11, color: SUB, padding: '4px 0 8px' }}>
              Their welcome email may be sitting in spam — worth a personal follow-up.
            </div>
          </>
        )}
        {noOpenHouse.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: SUB, paddingTop: 4 }}>
              {`Logged in, no open house yet (${noOpenHouse.length})`}
            </div>
            {noOpenHouse.slice(0, 5).map((a) => (
              <Line key={a.id} left={a.name} sub={a.email} right={`joined ${fmtDate(a.created_at)}`} />
            ))}
          </>
        )}
      </Panel>

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

      {/* Lifetime marketing numbers — live tables + deletion archives, so an
          agent cleaning up their dashboard doesn't shrink these. */}
      {data.funnel && (
        <Panel title="Lifetime Numbers">
          <FunnelTable
            rows={[
              { label: 'Open houses created', counts: data.funnel.openHousesCreated },
              { label: 'Visitors logged', counts: data.funnel.visitorsLogged },
              { label: 'QR scans (form loads)', counts: data.funnel.scans },
            ]}
          />
          {data.funnel.conversionPct30d !== null && (
            <div style={{ fontSize: 12, color: SUB, paddingTop: 8, borderTop: '1px solid #f0f0f2' }}>
              Scan → registration (30 days): <strong style={{ color: INK }}>{data.funnel.conversionPct30d}%</strong>
              {' '}· scans logged since Jul 20, 2026
            </div>
          )}
        </Panel>
      )}

      {data.funnel && (
        <Panel title="Scanned, Didn't Register">
          {data.funnel.abandonedScans.length === 0 && <Muted>No abandoned scans yet.</Muted>}
          {data.funnel.abandonedScans.slice(0, 8).map((s, i) => (
            <div key={`${s.scanned_at}-${i}`} style={{ padding: '8px 0', borderTop: '1px solid #f0f0f2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.openHouseAddress}
                </div>
                <div style={{ fontSize: 12, color: SUB, whiteSpace: 'nowrap' }}>{fmtDateTime(s.scanned_at)}</div>
              </div>
              <div style={{ fontSize: 12, color: SUB, marginTop: 2 }}>
                {s.agentName} · {deviceLabel(s.user_agent)} · {s.ip_address}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: SUB, paddingTop: 8 }}>
            Includes agent test scans, bots, and repeat loads — timestamps are what matter.
          </div>
        </Panel>
      )}
    </div>
  )
}

// Aligned grid: one labeled row per metric, three right-aligned number
// columns under Lifetime / 12 mo / 30 d headers.
function FunnelTable({ rows }: { rows: { label: string; counts: WindowCounts }[] }) {
  const num = { textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', columnGap: 18, rowGap: 0, alignItems: 'baseline' }}>
      <div />
      {['Lifetime', '12 mo', '30 d'].map(h => (
        <div key={h} style={{ ...num, fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: 0.5, paddingBottom: 4 }}>{h}</div>
      ))}
      {rows.map(r => (
        <Fragment key={r.label}>
          <div style={{ fontSize: 13, fontWeight: 600, padding: '8px 0', borderTop: '1px solid #f0f0f2' }}>{r.label}</div>
          <div style={{ ...num, fontSize: 15, fontWeight: 700, color: INK, padding: '8px 0', borderTop: '1px solid #f0f0f2' }}>{r.counts.lifetime.toLocaleString()}</div>
          <div style={{ ...num, fontSize: 13, color: SUB, padding: '8px 0', borderTop: '1px solid #f0f0f2' }}>{r.counts.last12mo.toLocaleString()}</div>
          <div style={{ ...num, fontSize: 13, color: SUB, padding: '8px 0', borderTop: '1px solid #f0f0f2' }}>{r.counts.last30d.toLocaleString()}</div>
        </Fragment>
      ))}
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

function Line({ left, sub, right }: { left: string; sub: string; right: React.ReactNode }) {
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
