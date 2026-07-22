'use client'
import { useState, useEffect } from 'react'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'

// The sponsor dashboard: a 3rd-party provider (lender, title, insurance…)
// maintains the card that appears below the host agent's card in visitor
// emails, and manages which agents they sponsor. Agents must accept an
// emailed invitation before anything shows on their open houses.

const inputStyle = {
  width: '100%',
  background: '#f5f5f7',
  border: '1px solid #d1d1d6',
  borderRadius: '9px',
  padding: '10px 12px',
  fontSize: '14px',
  color: '#1d1d1f',
  outline: 'none',
  boxSizing: 'border-box' as const,
  fontFamily: "'Plus Jakarta Sans', sans-serif"
}

const labelStyle = {
  display: 'block' as const,
  fontSize: '11px',
  fontWeight: '600' as const,
  color: '#6e6e73',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.6px',
  marginBottom: '6px'
}

const cardStyle = {
  background: 'white',
  borderRadius: '18px',
  border: '1px solid #d1d1d6',
  padding: '20px 22px',
  marginBottom: '16px'
}

type Invite = { id: string; email: string; expires_at: string; created_at: string }
type LinkedAgent = { id: string; full_name: string | null; email: string | null; brokerage: string | null }

export default function SponsorDashboard() {
  const [user, setUser] = useState<any>(null)
  const [sponsor, setSponsor] = useState<any>(null)
  const [isNew, setIsNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [invites, setInvites] = useState<Invite[]>([])
  const [agents, setAgents] = useState<LinkedAgent[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

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
        await loadLinks()
      } else {
        // First visit: start a blank profile; saving creates the row.
        setIsNew(true)
        setSponsor({
          owner_id: session.user.id,
          full_name: '',
          company: '',
          display_email: session.user.email || '',
          phone: '',
          license_number: '',
          headshot_url: '',
          logo_url: '',
        })
      }
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadLinks = async () => {
    try {
      const res = await fetch('/api/sponsor/invitations', { headers: await authHeaders() })
      if (!res.ok) return
      const json = await res.json()
      setInvites(json.invites || [])
      setAgents(json.agents || [])
    } catch { /* leave lists as-is */ }
  }

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
    if (isNew) { setIsNew(false); await loadLinks() }
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
        await loadLinks()
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
      const res = await fetch(`/api/sponsor/invitations/${id}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      })
      if (res.ok) { showToast('Invite revoked.'); await loadLinks() }
      else showToast('Could not revoke the invite.', 'error')
    } catch {
      showToast('Could not revoke the invite.', 'error')
    }
  }

  const removeAgent = async (id: string) => {
    setRemoveConfirm(null)
    try {
      const res = await fetch(`/api/sponsor/agents/${id}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      })
      if (res.ok) { showToast('Sponsorship ended.'); await loadLinks() }
      else showToast('Could not remove the agent.', 'error')
    } catch {
      showToast('Could not remove the agent.', 'error')
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/sponsor'
  }

  if (loading) return (
    <main style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ fontSize: '16px', color: '#6e6e73' }}>Loading...</div>
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#f5f5f7', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: '48px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Topbar */}
      <div style={{ background: '#1d1d1f', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '20px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px' }}>
            oh<span style={{ fontWeight: '700' }}>ACCESS</span>
          </div>
          <div style={{ background: 'rgba(201,150,58,0.25)', border: '1px solid rgba(201,150,58,0.6)', color: '#e8c479', fontSize: '10px', fontWeight: '700', letterSpacing: '0.6px', textTransform: 'uppercase', borderRadius: '999px', padding: '3px 10px' }}>
            Sponsor
          </div>
        </div>
        <button onClick={signOut} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px 0' }}>

        {isNew && (
          <div style={{ ...cardStyle, background: '#fdf4e3', border: '1px solid #ead9ad' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#1d1d1f', marginBottom: '6px' }}>Welcome! Set up your sponsor profile.</div>
            <div style={{ fontSize: '13px', color: '#48484a', lineHeight: '1.6' }}>
              Fill in your card below and save it — then invite the agents you work with.
              Once an agent accepts, your card appears below theirs in every email their
              open-house visitors receive.
            </div>
          </div>
        )}

        {/* Sponsor profile */}
        <div style={cardStyle}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Your sponsor card</div>
          <div style={{ fontSize: '12px', color: '#6e6e73', margin: '12px 0 16px', lineHeight: '1.5' }}>
            Everything here is shown to open-house visitors in the &ldquo;Sponsored by&rdquo; section of their email.
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
            style={{ marginTop: '18px', width: '100%', background: '#1d1d1f', color: 'white', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving...' : isNew ? 'Create sponsor profile →' : 'Save changes'}
          </button>
        </div>

        {/* Agents */}
        {!isNew && (
          <div style={cardStyle}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Agents you sponsor</div>
            <div style={{ fontSize: '12px', color: '#6e6e73', margin: '12px 0 14px', lineHeight: '1.5' }}>
              Invite an agent by the email they use for ohACCESS. Nothing appears on their open
              houses until they accept your invitation.
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
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
                style={{ background: '#1d1d1f', color: 'white', border: 'none', borderRadius: '9px', padding: '10px 18px', fontSize: '13px', fontWeight: '600', cursor: inviteBusy ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: inviteBusy ? 0.7 : 1, whiteSpace: 'nowrap' as const }}
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

            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>Active sponsorships</div>
              {agents.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#aeaeb2', padding: '4px 0' }}>No agents yet — invites you send will show up here once accepted.</div>
              ) : (
                agents.map(a => (
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
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? '#cc0000' : '#1d1d1f', color: 'white', borderRadius: '12px', padding: '12px 20px', fontSize: '13px', fontWeight: '600', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 100, maxWidth: '90vw', textAlign: 'center' as const }}>
          {toast.message}
        </div>
      )}
    </main>
  )
}
