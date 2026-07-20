'use client'
import { useState } from 'react'
import { onColor, readableOnLight, fillBorder } from '@/lib/colors'
import { timelineStyle } from '@/lib/timeline'
import { isVirtualNumber } from '@/lib/register-helpers'

// A hard delivery failure reported by Resend (email) or Twilio (SMS) means the
// visitor's contact info is likely bad.
const deliveryFailed = (status: string | null | undefined): boolean =>
  status === 'bounced' || status === 'complained' || status === 'undelivered' || status === 'failed'
const failBadge = { marginLeft: '8px', background: '#fff0f0', color: '#cc0000', border: '1px solid #f0c0c0', borderRadius: '6px', padding: '1px 6px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' as const }
const optedOutBadge = { marginLeft: '8px', background: '#f2f2f7', color: '#6e6e73', border: '1px solid #d1d1d6', borderRadius: '6px', padding: '1px 6px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' as const }
const voipBadge = { marginLeft: '8px', background: '#fff8e6', color: '#8a6100', border: '1px solid #f0d896', borderRadius: '6px', padding: '1px 6px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' as const }

// Shared visitor detail + notes editor. Used both in the dashboard panel
// (modal) and on the standalone mobile /visitor/[id] page, so the verify
// toggle and notes-save logic live in exactly one place. Saves via the
// (authenticated) supabase client; the visitors RLS policy already restricts
// writes to the owning agent.
export default function VisitorDetail({ visitor, supabase, primaryColor = '#1d1d1f', accentColor = '#0071e3', onChange, onDelete }: {
  visitor: any
  supabase: any
  primaryColor?: string
  accentColor?: string
  onChange?: (fields: { verified?: boolean; notes?: string }) => void
  // When provided, a "Delete visitor" button is shown. Called after the visitor
  // is successfully deleted, so the parent can close the modal / refresh its list.
  onDelete?: () => void
}) {
  // Keep accent text/buttons readable for near-white accents (lib/colors).
  const accentText = readableOnLight(accentColor)
  const onAccent = onColor(accentColor)
  const accentBtnBorder = fillBorder(accentColor)
  const onPrimary = onColor(primaryColor)
  const primaryBtnBorder = fillBorder(primaryColor)
  const [notes, setNotes] = useState<string>(visitor.notes || '')
  const [verified, setVerified] = useState<boolean>(!!visitor.verified)
  const [savingNotes, setSavingNotes] = useState(false)
  const [savedNotes, setSavedNotes] = useState(false)
  const [busyVerify, setBusyVerify] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  const tl = timelineStyle(visitor.purchasing_timeline)
  const dirty = notes !== (visitor.notes || '')

  const toggleVerify = async () => {
    const next = !verified
    setBusyVerify(true)
    setVerified(next)
    const { error } = await supabase.from('visitors').update({ verified: next }).eq('id', visitor.id)
    setBusyVerify(false)
    if (error) { setVerified(!next); return }
    onChange?.({ verified: next })
  }

  const saveNotes = async () => {
    setSavingNotes(true)
    setSavedNotes(false)
    const { error } = await supabase.from('visitors').update({ notes }).eq('id', visitor.id)
    setSavingNotes(false)
    if (!error) {
      setSavedNotes(true)
      visitor.notes = notes
      onChange?.({ notes })
      setTimeout(() => setSavedNotes(false), 2000)
    }
  }

  const deleteVisitor = async () => {
    setDeleting(true)
    setDeleteError(false)
    // Server-side delete (owner-checked) so the record is archived first —
    // a dashboard delete must not destroy the record of who was in the house.
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/visitor/${visitor.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      setDeleting(false)
      if (!res.ok) { setDeleteError(true); return }
      onDelete?.()
    } catch {
      setDeleting(false)
      setDeleteError(true)
    }
  }

  const label = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#6e6e73', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '4px' }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#1d1d1f' }}>
          {`${visitor.first_name || ''} ${visitor.last_name || ''}`.trim() || 'Visitor'}
        </div>
        {visitor.purchasing_timeline && (
          <span style={{ background: tl.bg, color: tl.color, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{visitor.purchasing_timeline}</span>
        )}
      </div>

      <div style={{ marginTop: '14px', display: 'grid', gap: '10px' }}>
        <div><div style={label}>Phone</div><a href={`tel:${visitor.phone}`} style={{ fontSize: '15px', color: accentText, textDecoration: 'none', fontWeight: 600 }}>{visitor.phone || '—'}</a>{visitor.sms_opted_out ? <span style={optedOutBadge} title="This number replied STOP — do not contact">🚫 opted out</span> : deliveryFailed(visitor.sms_status) ? <span style={failBadge} title="Text could not be delivered to this number">⚠ text undelivered</span> : null}{isVirtualNumber(visitor.phone_line_type) && <span style={voipBadge} title="Internet/VoIP number (TextNow, Google Voice, …), not a carrier mobile line. Many are legitimate — consider extra ID verification.">⚠ VoIP number</span>}</div>
        <div><div style={label}>Email</div><a href={`mailto:${visitor.email}`} style={{ fontSize: '15px', color: accentText, textDecoration: 'none', fontWeight: 600, wordBreak: 'break-all' }}>{visitor.email || '—'}</a>{deliveryFailed(visitor.email_status) && <span style={failBadge} title="Email bounced — this address may be invalid">⚠ email bounced</span>}</div>
        <div><div style={label}>Registered</div><div style={{ fontSize: '14px', color: '#1d1d1f' }}>{visitor.registered_at ? new Date(visitor.registered_at).toLocaleString() : '—'}</div></div>
      </div>

      <button
        onClick={toggleVerify}
        disabled={busyVerify}
        style={{ marginTop: '16px', width: '100%', background: verified ? '#30d158' : primaryColor, color: verified ? 'white' : onPrimary, border: verified ? 'none' : primaryBtnBorder, borderRadius: '12px', padding: '13px', fontSize: '15px', fontWeight: 700, cursor: busyVerify ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: busyVerify ? 0.6 : 1 }}
      >
        {verified ? '✓ Verified at door' : 'Mark as verified at door'}
      </button>

      <div style={{ marginTop: '18px' }}>
        <div style={label}>Notes</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Pre-approved, wants 3BR, serious buyer — following up Monday."
          rows={4}
          style={{ width: '100%', background: '#f5f5f7', border: '1px solid #d1d1d6', borderRadius: '12px', padding: '12px', fontSize: '14px', color: '#1d1d1f', outline: 'none', boxSizing: 'border-box', fontFamily: "'Plus Jakarta Sans', sans-serif", resize: 'vertical' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          {savedNotes && <span style={{ fontSize: '13px', color: '#30d158', fontWeight: 600 }}>✓ Saved</span>}
          <button
            onClick={saveNotes}
            disabled={savingNotes || !dirty}
            style={{ background: dirty ? accentColor : '#e8e8ed', color: dirty ? onAccent : '#aeaeb2', border: dirty ? accentBtnBorder : 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '14px', fontWeight: 700, cursor: savingNotes || !dirty ? 'default' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {savingNotes ? 'Saving…' : 'Save notes'}
          </button>
        </div>
      </div>

      {onDelete && (
        <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: '1px solid #f2f2f7' }}>
          {!confirmingDelete ? (
            <button
              onClick={() => { setConfirmingDelete(true); setDeleteError(false) }}
              style={{ width: '100%', background: 'none', color: '#cc0000', border: '1px solid #f0c0c0', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Delete visitor
            </button>
          ) : (
            <div>
              <div style={{ fontSize: '13px', color: '#1d1d1f', lineHeight: 1.5, marginBottom: '10px' }}>
                Permanently delete <strong>{`${visitor.first_name || ''} ${visitor.last_name || ''}`.trim() || 'this visitor'}</strong> and all their information? This can&apos;t be undone.
              </div>
              {deleteError && <div style={{ fontSize: '13px', color: '#cc0000', fontWeight: 600, marginBottom: '10px' }}>Couldn&apos;t delete — please try again.</div>}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  style={{ flex: 1, background: '#f5f5f7', color: '#1d1d1f', border: 'none', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: deleting ? 'default' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Cancel
                </button>
                <button
                  onClick={deleteVisitor}
                  disabled={deleting}
                  style={{ flex: 1, background: '#cc0000', color: 'white', border: 'none', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: deleting ? 0.6 : 1 }}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
