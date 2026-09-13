'use client'
import { useState, useEffect } from 'react'

// "✉️ Visitor email" modal — opened from an open-house card. Shows the
// next-morning thank-you email (After Tour questions + upcoming open houses)
// in the agent's own branding, built server-side by
// GET /api/open-house/[id]/thank-you-preview exactly like the real send. When
// the agent has nothing scheduled, the email carries example open houses and
// this modal nudges them to schedule their next one.

type Preview = {
  subject: string
  html: string
  visitorFirst: string | null
  visitors: number
  sent: number
  upcomingCount: number
  usingExamples: boolean
}

export default function ThankYouPreviewModal({
  oh,
  onClose,
  onSchedule,
  authHeaders,
  accentColor,
  onAccent,
  accentBtnBorder,
}: {
  oh: any
  onClose: () => void
  onSchedule: () => void
  authHeaders: () => Promise<HeadersInit>
  accentColor: string
  onAccent: string
  accentBtnBorder: string
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/open-house/${oh.id}/thank-you-preview`, { headers: await authHeaders() })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) { setLoadError(true); return }
        setPreview(json)
      } catch {
        if (!cancelled) setLoadError(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [oh.id])

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  // Visitors type their own names ("john"); tidy it for the agent-facing line.
  const nameOf = (p: Preview) => (p.visitorFirst || '').replace(/^./, c => c.toUpperCase())

  // What this email has done so far for this open house, in one line.
  const statusLine = (p: Preview): string => {
    if (p.sent > 0) return `Sent to ${plural(p.sent, 'visitor')} the morning after they signed in. Below is ${nameOf(p)}'s copy.`
    if (p.visitors > 0) return `Goes out at 9 AM the morning after each visit. Below is how ${nameOf(p)}'s will look.`
    return 'Every visitor gets this at 9 AM the morning after they sign in, automatically. Shown here with a sample visitor.'
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}
      onClick={onClose}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '24px', maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f' }}>✉️ Your visitors&rsquo; follow-up email</div>
            <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{oh.property_address}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aeaeb2', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}>✕</button>
        </div>

        {!preview && !loadError && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#6e6e73', fontSize: '13px' }}>Loading the email…</div>
        )}

        {loadError && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#cc0000', fontSize: '13px' }}>Could not load the email preview. Please close and try again.</div>
        )}

        {preview && (
          <>
            <div style={{ fontSize: '13px', color: '#1d1d1f', lineHeight: 1.55, margin: '10px 0' }}>
              {statusLine(preview)} ohACCESS sends it for you, in your branding, with the After Tour questions and your upcoming open houses. Replies go straight to your inbox.
            </div>

            {preview.usingExamples ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: '#fff8e6', border: '1px solid #f5d98b', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#6b4e00', lineHeight: 1.5, flex: '1 1 260px' }}>
                  <strong>{'You have no other open houses in the next 10 days, '}</strong>{'so visitors aren’t seeing any. The dashed box shows what they’d get: schedule ahead and yours appear automatically, with add-to-calendar buttons.'}
                </div>
                <button onClick={onSchedule} style={{ padding: '8px 14px', background: accentColor, color: onAccent, border: accentBtnBorder, borderRadius: '9px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>+ Schedule an open house</button>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: '#1a7a3c', background: '#e8f9ee', borderRadius: '10px', padding: '8px 12px', marginBottom: '12px' }}>
                ✓ Your next {plural(preview.upcomingCount, 'open house')} {preview.upcomingCount === 1 ? 'is' : 'are'} included, with add-to-calendar buttons.
              </div>
            )}

            <div style={{ fontSize: '11px', color: '#6e6e73', marginBottom: '6px' }}>Subject: <strong style={{ color: '#1d1d1f' }}>{preview.subject}</strong></div>
            {/* sandbox with no permissions: the email HTML can't run scripts
                or navigate; links are also styled inert server-side. */}
            <iframe
              title="Visitor follow-up email preview"
              srcDoc={preview.html}
              sandbox=""
              style={{ display: 'block', width: '100%', minHeight: '320px', height: '60vh', border: '1px solid #e5e5ea', borderRadius: '12px', background: '#eceef1' }}
            />
          </>
        )}
      </div>
    </div>
  )
}
