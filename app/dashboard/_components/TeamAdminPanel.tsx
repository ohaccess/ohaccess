'use client'
import { useState, useEffect, useCallback } from 'react'
import { onColor, fillBorder } from '@/lib/colors'

interface Member {
  id: string
  full_name: string | null
  email: string | null
  role: string
  created_at: string
}
interface Invitation {
  id: string
  email: string
  role: string
  expires_at: string
  created_at: string
}
interface Brokerage {
  id: string
  name: string
  tier: 'team' | 'brokerage'
  logo_url: string | null
  primary_color: string | null
  accent_color: string | null
  owner_id: string
}

const card = {
  background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6',
  padding: '20px 22px', marginBottom: '16px',
}
const cardHeader = {
  fontSize: '13px', fontWeight: 600, color: '#1d1d1f', marginBottom: '4px',
  paddingBottom: '12px', borderBottom: '1px solid #d1d1d6',
}
const inputStyle = {
  width: '100%', background: '#f5f5f7', border: '1px solid #d1d1d6', borderRadius: '9px',
  padding: '10px 12px', fontSize: '14px', color: '#1d1d1f', outline: 'none',
  boxSizing: 'border-box' as const, fontFamily: "'Plus Jakarta Sans', sans-serif",
}
const btn = (bg: string) => ({
  // Dark label + hairline edge when bg is light, so a near-white brand
  // color doesn't make the button vanish (see lib/colors).
  background: bg, color: onColor(bg), border: fillBorder(bg), borderRadius: '9px', padding: '10px 18px',
  fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
})

export default function TeamAdminPanel({ supabase, showToast, onSaved }: {
  supabase: any
  showToast: (m: string, t?: 'success' | 'error') => void
  onSaved?: () => void | Promise<void>
}) {
  const [loading, setLoading] = useState(true)
  const [brokerage, setBrokerage] = useState<Brokerage | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [seats, setSeats] = useState<{ used: number; limit: number }>({ used: 0, limit: 0 })
  const [inviteEmail, setInviteEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [logo, setLogo] = useState('')
  const [primary, setPrimary] = useState('#1d1d1f')
  const [accent, setAccent] = useState('#0071e3')

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }, [supabase])

  const load = useCallback(async () => {
    const res = await fetch('/api/team/settings', { headers: await authHeaders() })
    if (!res.ok) { setLoading(false); return }
    const json = await res.json()
    setBrokerage(json.brokerage)
    setMembers(json.members)
    setInvitations(json.invitations)
    setSeats(json.seats)
    setName(json.brokerage.name || '')
    setLogo(json.brokerage.logo_url || '')
    setPrimary(json.brokerage.primary_color || '#1d1d1f')
    setAccent(json.brokerage.accent_color || '#0071e3')
    setLoading(false)
  }, [authHeaders])

  useEffect(() => { load() }, [load])

  const saveSettings = async () => {
    setBusy('settings')
    const res = await fetch('/api/team/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ name, logo_url: logo, primary_color: primary, accent_color: accent }),
    })
    const json = await res.json()
    if (res.ok) { showToast('Team settings saved'); await load(); await onSaved?.() }
    else showToast(json.error || 'Could not save settings', 'error')
    setBusy(null)
  }

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('invite')
    const res = await fetch('/api/team/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ email: inviteEmail }),
    })
    const json = await res.json()
    if (res.ok) { showToast(`Invite sent to ${json.email}`); setInviteEmail(''); await load() }
    else showToast(json.error || 'Could not send invite', 'error')
    setBusy(null)
  }

  const revokeInvite = async (id: string) => {
    setBusy(`inv-${id}`)
    const res = await fetch(`/api/team/invitations/${id}`, { method: 'DELETE', headers: await authHeaders() })
    if (res.ok) { showToast('Invite revoked'); await load() }
    else showToast('Could not revoke invite', 'error')
    setBusy(null)
  }

  const removeMember = async (id: string) => {
    setBusy(`mem-${id}`)
    const res = await fetch(`/api/team/members/${id}`, { method: 'DELETE', headers: await authHeaders() })
    const json = await res.json()
    if (res.ok) { showToast('Member removed'); await load() }
    else showToast(json.error || 'Could not remove member', 'error')
    setBusy(null)
  }

  if (loading) return <div style={{ color: '#6e6e73', fontSize: '14px', padding: '20px' }}>Loading team…</div>
  if (!brokerage) return <div style={{ color: '#6e6e73', fontSize: '14px', padding: '20px' }}>No team found.</div>

  const seatsFull = seats.used >= seats.limit
  const tierLabel = brokerage.tier === 'brokerage' ? 'Brokerage' : 'Team'

  return (
    <>
      <div style={{ fontSize: '24px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>Team management</div>
      <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '20px' }}>
        Manage your agents, branding, and seats. {tierLabel} plan · {seats.used} of {seats.limit} seats used.
      </div>

      {/* SEATS + INVITE */}
      <div style={card}>
        <div style={cardHeader}>Agents</div>
        <div style={{ fontSize: '12px', color: seatsFull ? '#cc0000' : '#6e6e73', marginBottom: '16px' }}>
          {seats.used} of {seats.limit} seats used{seatsFull ? ' — your team is full' : ''}
        </div>

        <form onSubmit={sendInvite} style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
          <input
            type="email" required placeholder="agent@email.com" value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)} disabled={seatsFull || busy !== null}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="submit" disabled={seatsFull || busy !== null} style={{ ...btn('#1d1d1f'), whiteSpace: 'nowrap', opacity: seatsFull || busy ? 0.5 : 1 }}>
            {busy === 'invite' ? 'Sending…' : 'Invite agent'}
          </button>
        </form>

        {/* Members */}
        {members.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #f2f2f7' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#1d1d1f', fontWeight: 500 }}>
                {m.full_name || m.email}
                {m.id === brokerage.owner_id && <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 700, color: '#c9963a', background: 'rgba(201,150,58,0.12)', padding: '2px 8px', borderRadius: '10px' }}>TEAM LEAD</span>}
              </div>
              <div style={{ fontSize: '12px', color: '#6e6e73' }}>{m.email}</div>
            </div>
            {m.id !== brokerage.owner_id && (
              <button onClick={() => removeMember(m.id)} disabled={busy !== null} style={{ background: 'none', border: '1px solid #d1d1d6', color: '#cc0000', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {busy === `mem-${m.id}` ? '…' : 'Remove'}
              </button>
            )}
          </div>
        ))}

        {/* Pending invitations */}
        {invitations.map(inv => (
          <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #f2f2f7' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#1d1d1f' }}>{inv.email}</div>
              <div style={{ fontSize: '12px', color: '#c9963a', fontWeight: 600 }}>Pending invite</div>
            </div>
            <button onClick={() => revokeInvite(inv.id)} disabled={busy !== null} style={{ background: 'none', border: '1px solid #d1d1d6', color: '#6e6e73', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {busy === `inv-${inv.id}` ? '…' : 'Revoke'}
            </button>
          </div>
        ))}
      </div>

      {/* BRANDING */}
      <div style={card}>
        <div style={cardHeader}>Team branding</div>
        <div style={{ fontSize: '12px', color: '#6e6e73', marginBottom: '16px' }}>
          Your logo and colors appear on every team member&apos;s visitor emails. Only you (the team lead) can change these.
        </div>

        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>Team name</label>
        <input style={{ ...inputStyle, marginBottom: '16px' }} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Premier Realty Team" />

        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>Team logo URL</label>
        <input style={inputStyle} type="url" placeholder="https://yoursite.com/logo.png" value={logo} onChange={e => setLogo(e.target.value)} />
        <div style={{ fontSize: '11px', color: '#aeaeb2', marginTop: '6px', marginBottom: logo ? '10px' : '18px' }}>
          Paste a direct image URL (ending in .png, .jpg, or .svg). Leave blank to remove. Appears on every team member&apos;s visitor emails and registration forms.
        </div>
        {logo && (
          <div style={{ marginBottom: '18px', background: '#f5f5f7', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '52px', border: '1px solid #d1d1d6' }}>
            <img
              src={logo}
              alt="Team logo preview"
              style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain', display: 'block' }}
              onError={e => {
                const el = e.target as HTMLImageElement
                el.style.display = 'none'
                const parent = el.parentElement
                if (parent) parent.innerHTML = '<span style="font-size:11px;color:#cc0000;">⚠️ Image could not load — check the URL</span>'
              }}
            />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>Primary color</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} style={{ width: '48px', height: '38px', border: '1px solid #d1d1d6', borderRadius: '8px', cursor: 'pointer', padding: '2px' }} />
              <input style={{ ...inputStyle, flex: 1 }} type="text" value={primary} onChange={e => setPrimary(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>Accent color</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="color" value={accent} onChange={e => setAccent(e.target.value)} style={{ width: '48px', height: '38px', border: '1px solid #d1d1d6', borderRadius: '8px', cursor: 'pointer', padding: '2px' }} />
              <input style={{ ...inputStyle, flex: 1 }} type="text" value={accent} onChange={e => setAccent(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={saveSettings} disabled={busy !== null} style={{ ...btn(primary), opacity: busy ? 0.6 : 1 }}>
            {busy === 'settings' ? 'Saving…' : '✓ Save team settings'}
          </button>
        </div>
      </div>
    </>
  )
}
