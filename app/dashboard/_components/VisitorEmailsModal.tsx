'use client'
import { useState, useEffect } from 'react'

// "✉️ Visitor emails" modal — opened from an open-house card. One tab per
// email a visitor can get (codeword at sign-in, thank-you the next morning,
// invite to a future open house), each shown in the agent's own branding,
// built server-side by GET /api/open-house/[id]/visitor-emails-preview exactly
// like the real sends. When the agent has nothing scheduled, the emails carry
// example open houses and this modal nudges them to schedule their next one.

type Email = { subject: string; html: string }
type Previews = {
  visitors: number
  upcomingCount: number
  usingExamples: boolean
  codeword: Email
  thankYou: Email & { visitorFirst: string | null; sent: number }
  invite: Email & { invitesSent: number; target: 'this' | 'next' | 'example'; targetAddress: string }
}
type Tab = 'codeword' | 'thankYou' | 'invite'

const TABS: { key: Tab; step: string; label: string }[] = [
  { key: 'codeword', step: 'At sign-in', label: 'Codeword' },
  { key: 'thankYou', step: 'Next morning', label: 'Thank you' },
  { key: 'invite', step: 'When you invite', label: 'Future open house' },
]

export default function VisitorEmailsModal({
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
  const [previews, setPreviews] = useState<Previews | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState<Tab>('codeword')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/open-house/${oh.id}/visitor-emails-preview`, { headers: await authHeaders() })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) { setLoadError(true); return }
        setPreviews(json)
      } catch {
        if (!cancelled) setLoadError(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [oh.id])

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  // Visitors type their own names ("john"); tidy it for the agent-facing line.
  const cap = (s: string | null) => (s || '').replace(/^./, c => c.toUpperCase())

  // When this email goes out, and what it has done so far, in one line.
  const statusLine = (p: Previews): string => {
    if (tab === 'codeword') {
      return p.visitors > 0
        ? `Sent the moment someone signs in, along with a separate text codeword. ${plural(p.visitors, 'visitor')} got it for this open house, and you're copied on each one.`
        : `Sent the moment someone signs in, along with a separate text codeword. You're copied on each one.`
    }
    if (tab === 'thankYou') {
      if (p.thankYou.sent > 0) return `Sent automatically the morning after each visit. ${plural(p.thankYou.sent, 'visitor')} got it for this open house. Below is ${cap(p.thankYou.visitorFirst)}'s copy.`
      if (p.visitors > 0) return `Sent automatically at 9 AM the morning after each visit. Below is how ${cap(p.thankYou.visitorFirst)}'s will look.`
      return 'Sent automatically at 9 AM the morning after each visit, with the After Tour questions. Shown here with a sample visitor.'
    }
    const sentBit = p.invite.invitesSent > 0 ? ` You've sent ${plural(p.invite.invitesSent, 'invite')} so far.` : ''
    return `Sent only when you click 💌 Invite on an upcoming open house. It goes to past visitors who are still in their buying window.${sentBit}`
  }

  const scheduleButton = (
    <button onClick={onSchedule} style={{ padding: '8px 14px', background: accentColor, color: onAccent, border: accentBtnBorder, borderRadius: '9px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>+ Schedule an open house</button>
  )
  const nudge = (text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: '#fff8e6', border: '1px solid #f5d98b', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px' }}>
      <div style={{ fontSize: '12px', color: '#6b4e00', lineHeight: 1.5, flex: '1 1 260px' }}>{text}</div>
      {scheduleButton}
    </div>
  )
  const good = (text: string) => (
    <div style={{ fontSize: '12px', color: '#1a7a3c', background: '#e8f9ee', borderRadius: '10px', padding: '8px 12px', marginBottom: '12px' }}>{text}</div>
  )

  const callout = (p: Previews) => {
    if (tab === 'invite') {
      if (p.invite.target === 'example') return nudge('You have no upcoming open houses to invite past visitors to, so this shows an example. Schedule one, then click 💌 Invite on its card.')
      if (p.invite.target === 'next') return good(`Shown for your next open house, ${p.invite.targetAddress}, as this home's visitors would get it.`)
      return good('Shown for this open house, as a visitor from your last open house would get it.')
    }
    if (p.usingExamples) return nudge('You have no other open houses in the next 10 days, so visitors aren’t seeing any. The dashed box shows what they’d get: schedule ahead and yours appear automatically, with add-to-calendar buttons.')
    return good(`✓ Your next ${plural(p.upcomingCount, 'open house')} ${p.upcomingCount === 1 ? 'is' : 'are'} included, with add-to-calendar buttons.`)
  }

  const email = previews ? previews[tab] : null

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}
      onClick={onClose}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '24px', maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f' }}>✉️ What your visitors receive</div>
            <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{oh.property_address}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aeaeb2', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}>✕</button>
        </div>

        {/* Tabs, in the order a visitor gets the emails. Scroll sideways on a
            narrow phone rather than wrapping. */}
        <div style={{ display: 'flex', gap: '6px', margin: '14px 0 12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
          {TABS.map(t => {
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: '1 0 auto', textAlign: 'left', padding: '8px 12px', background: active ? accentColor : '#f5f5f7', color: active ? onAccent : '#1d1d1f', border: active ? accentBtnBorder : '1px solid #e5e5ea', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.step}</div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>{t.label}</div>
              </button>
            )
          })}
        </div>

        {!previews && !loadError && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#6e6e73', fontSize: '13px' }}>Loading your visitor emails…</div>
        )}

        {loadError && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#cc0000', fontSize: '13px' }}>Could not load the email previews. Please close and try again.</div>
        )}

        {previews && email && (
          <>
            <div style={{ fontSize: '13px', color: '#1d1d1f', lineHeight: 1.55, marginBottom: '10px' }}>
              {`${statusLine(previews)} Every email goes out in your branding, and replies go straight to your inbox.`}
            </div>

            {callout(previews)}

            <div style={{ fontSize: '11px', color: '#6e6e73', marginBottom: '6px' }}>Subject: <strong style={{ color: '#1d1d1f' }}>{email.subject}</strong></div>
            {/* sandbox with no permissions: the email HTML can't run scripts
                or navigate; links are also styled inert server-side. */}
            <iframe
              key={tab}
              title="Visitor email preview"
              srcDoc={email.html}
              sandbox=""
              style={{ display: 'block', width: '100%', minHeight: '320px', height: '60vh', border: '1px solid #e5e5ea', borderRadius: '12px', background: '#eceef1' }}
            />
          </>
        )}
      </div>
    </div>
  )
}
