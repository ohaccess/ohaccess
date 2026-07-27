'use client'
import { useState, useEffect } from 'react'
import { timelineStyle } from '@/lib/timeline'

// "Invite past visitors" modal — opened from an open-house card (or right
// after publishing a new one). Fetches the eligible audience from
// GET /api/open-house/[id]/invites, shows who's in / who's excluded and why,
// and sends via POST. The server recomputes eligibility on send, so this UI
// is purely informational — nothing here is trusted.

type Match = {
  email: string
  firstName: string
  lastName: string
  timeline: string | null
  lastVisitAt: string
  lastVisitAddress: string | null
}
type Excluded = { optedOut: number; badEmail: number; expired: number; alreadyInvited: number; frequencyCapped: number }
type Preview = { canSend: boolean; ended: boolean; matches: Match[]; truncated: number; excluded: Excluded }

const fmtVisit = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// Human breakdown of exclusions, only naming non-zero reasons.
const excludedLine = (x: Excluded): string => {
  const parts = [
    x.optedOut ? `${x.optedOut} opted out` : '',
    x.expired ? `${x.expired} past their buying window` : '',
    x.alreadyInvited ? `${x.alreadyInvited} already invited` : '',
    x.frequencyCapped ? `${x.frequencyCapped} invited recently` : '',
    x.badEmail ? `${x.badEmail} undeliverable email` : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

export default function InviteModal({
  oh,
  onClose,
  showToast,
  authHeaders,
  accentColor,
  onAccent,
  accentBtnBorder,
}: {
  oh: any
  onClose: () => void
  showToast: (message: string, type?: 'success' | 'error') => void
  authHeaders: () => Promise<HeadersInit>
  accentColor: string
  onAccent: string
  accentBtnBorder: string
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [sending, setSending] = useState(false)
  // The agent's checkbox selection — everyone starts checked; unchecking
  // drops people the agent judges a bad fit (wrong area, wrong price point).
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/open-house/${oh.id}/invites`, { headers: await authHeaders() })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) { setLoadError(true); return }
        setPreview(json)
        setSelected(new Set((json.matches ?? []).map((m: Match) => m.email)))
      } catch {
        if (!cancelled) setLoadError(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [oh.id])

  const toggle = (email: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email); else next.add(email)
      return next
    })
  }

  const send = async () => {
    if (!preview || sending || selected.size === 0) return
    setSending(true)
    try {
      const res = await fetch(`/api/open-house/${oh.id}/invites`, {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: [...selected] }),
      })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error || 'Could not send invites. Please try again.', 'error')
        setSending(false)
        return
      }
      showToast(json.sent > 0
        ? `Invites sent to ${json.sent} past visitor${json.sent === 1 ? '' : 's'}!`
        : 'No invites were sent.')
      onClose()
    } catch {
      showToast('Could not send invites. Please try again.', 'error')
      setSending(false)
    }
  }

  const excluded = preview ? excludedLine(preview.excluded) : ''
  const n = preview?.matches.length ?? 0

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}
      onClick={onClose}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '24px', maxWidth: '480px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f' }}>💌 Invite past visitors</div>
            <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '3px' }}>{oh.property_address}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aeaeb2', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}>✕</button>
        </div>

        {!preview && !loadError && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#6e6e73', fontSize: '13px' }}>Checking your past visitors…</div>
        )}

        {loadError && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#cc0000', fontSize: '13px' }}>Could not load your past visitors. Please close and try again.</div>
        )}

        {preview && (
          <>
            {n === 0 ? (
              <div style={{ padding: '28px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1d1d1f', marginBottom: '6px' }}>No past visitors are a match right now</div>
                <div style={{ fontSize: '12px', color: '#6e6e73', lineHeight: 1.6 }}>
                  As people sign in at your open houses, they become invitable here — while they&rsquo;re still inside the buying timeline they gave you.
                  {excluded ? <><br />Not included: {excluded}.</> : null}
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', margin: '12px 0 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ background: '#e8f9ee', color: '#1a7a3c', fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{selected.size} of {n} selected</span>
                    <span style={{ fontSize: '12px', color: '#6e6e73' }}>still in their buying window</span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <button onClick={() => setSelected(new Set(preview.matches.map(m => m.email)))} style={{ background: 'none', border: 'none', padding: 0, color: '#0071e3', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600 }}>All</button>
                    <span style={{ color: '#d1d1d6' }}> · </span>
                    <button onClick={() => setSelected(new Set())} style={{ background: 'none', border: 'none', padding: 0, color: '#0071e3', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600 }}>None</button>
                  </div>
                </div>
                {excluded && (
                  <div style={{ fontSize: '11px', color: '#6e6e73', marginBottom: '10px' }}>Not included: {excluded}</div>
                )}
                {preview.truncated > 0 && (
                  <div style={{ fontSize: '11px', color: '#8a6100', marginBottom: '10px' }}>Showing the first {n}; {preview.truncated} more can be invited in a later batch.</div>
                )}

                <div style={{ overflowY: 'auto', border: '1px solid #f2f2f7', borderRadius: '12px', flex: 1, minHeight: 0 }}>
                  {preview.matches.map(m => {
                    const c = timelineStyle(m.timeline || '')
                    const checked = selected.has(m.email)
                    return (
                      <label key={m.email} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderBottom: '1px solid #f2f2f7', cursor: 'pointer', opacity: checked ? 1 : 0.45 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(m.email)}
                          style={{ width: '16px', height: '16px', accentColor: accentColor, flexShrink: 0, cursor: 'pointer' }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1d1d1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.firstName} {m.lastName}</div>
                          <div style={{ fontSize: '11px', color: '#6e6e73', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            visited {m.lastVisitAddress ? `${m.lastVisitAddress} · ` : ''}{fmtVisit(m.lastVisitAt)}
                          </div>
                        </div>
                        {m.timeline && (
                          <span style={{ background: c.bg, color: c.color, padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{m.timeline}</span>
                        )}
                      </label>
                    )
                  })}
                </div>

                <div style={{ fontSize: '11px', color: '#6e6e73', margin: '12px 2px', lineHeight: 1.5 }}>
                  Each person gets a personal email from you with the property address (map link), add-to-calendar buttons, and one-click unsubscribe. Replies come to your inbox.
                </div>

                {preview.ended ? (
                  <div style={{ fontSize: '12px', color: '#cc0000', textAlign: 'center', padding: '8px 0' }}>This open house has already ended, so invites can&rsquo;t be sent.</div>
                ) : (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', background: '#f5f5f7', color: '#1d1d1f', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Not now</button>
                    <button disabled={sending || selected.size === 0} onClick={send} style={{ padding: '10px 20px', background: accentColor, color: onAccent, border: accentBtnBorder, borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: sending ? 'wait' : selected.size === 0 ? 'not-allowed' : 'pointer', opacity: sending || selected.size === 0 ? 0.6 : 1, fontFamily: 'inherit' }}>
                      {sending ? 'Sending…' : `Send ${selected.size} invite${selected.size === 1 ? '' : 's'}`}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
