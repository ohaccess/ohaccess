'use client'
import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import { timelineStyle, timelineRank } from '@/lib/timeline'
import { useSortable, applySort, type Sortable } from '@/lib/sort'
import { phoneLineKind, PHONE_LINE_CHIPS } from '@/lib/register-helpers'
import { langMeta } from '@/lib/register-i18n'

// The main "Dashboard" view: stat cards, the agent's open-house cards (with
// QR / copy / edit / delete actions), and the visitor log for the selected
// open house. Extracted verbatim from page.tsx; state + branding + action
// callbacks are passed in so page.tsx stays the coordinator.

// Columns + sort accessors for the per-open-house visitor list. Clicking a
// header toggles sort (shared useSortable/applySort, same as the admin tables).
const VISITOR_COLUMNS: { label: string; key: string }[] = [
  { label: 'Lang', key: 'lang' },
  { label: 'Name', key: 'name' },
  { label: 'Phone', key: 'phone' },
  { label: 'Email', key: 'email' },
  { label: 'Timeline', key: 'timeline' },
  { label: 'Registered', key: 'time' },
  { label: '✓', key: 'verified' },
]
const VISITOR_ACC: Record<string, (v: any) => Sortable> = {
  lang: (v) => langMeta(v.lang).label,
  name: (v) => `${v.first_name || ''} ${v.last_name || ''}`.trim(),
  phone: (v) => v.phone,
  email: (v) => v.email,
  timeline: (v) => timelineRank(v.purchasing_timeline),
  time: (v) => (v.registered_at ? new Date(v.registered_at).getTime() : null),
  verified: (v) => !!v.verified,
}

// Hover/tap explainer bubble. A native `title` is too slow and too cramped for
// the multi-line badge explanations, so this renders a real popover. Positioned
// `fixed` off the trigger's rect so it isn't clipped by the visitor table's
// horizontal-scroll container.
function Tip({ children, body, width = 300 }: { children: ReactNode; body: ReactNode; width?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; w: number; maxH: number } | null>(null)

  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const w = Math.min(width, window.innerWidth - 24)
    const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), Math.max(12, window.innerWidth - w - 12))
    // Open on whichever side of the trigger has more room, and cap the bubble
    // to that room (it scrolls past the cap) so a long explanation is never
    // clipped by the top or bottom of the window.
    const below = window.innerHeight - r.bottom - 20
    const above = r.top - 20
    return above > below
      ? setPos({ bottom: window.innerHeight - r.top + 8, left, w, maxH: above })
      : setPos({ top: r.bottom + 8, left, w, maxH: below })
  }
  const hide = () => setPos(null)

  // A bubble pinned to viewport coordinates goes stale the moment anything
  // scrolls underneath it, so close on any scroll.
  useEffect(() => {
    if (!pos) return
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [pos])

  return (
    <span
      ref={ref}
      style={{ display: 'inline-block' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      // Tap works on touch, where there is no hover. stopPropagation keeps a
      // tap on a column header's "?" from also re-sorting the table.
      onClick={(e) => { e.stopPropagation(); pos ? hide() : show() }}
    >
      {children}
      {pos && (
        <span role="tooltip" style={{
          position: 'fixed', left: `${pos.left}px`, width: `${pos.w}px`, zIndex: 3000,
          ...(pos.top !== undefined ? { top: `${pos.top}px` } : { bottom: `${pos.bottom}px` }),
          maxHeight: `${pos.maxH}px`, overflowY: 'auto',
          background: 'white', border: '1px solid #d1d1d6', borderRadius: '12px', padding: '12px 14px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.14)', fontSize: '12px', fontWeight: 400, lineHeight: 1.45,
          color: '#1d1d1f', textTransform: 'none', letterSpacing: 'normal', whiteSpace: 'normal',
          fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: 'default',
        }}>{body}</span>
      )}
    </span>
  )
}

const helpIconStyle = { marginLeft: '5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', background: '#e8e8ed', color: '#6e6e73', fontSize: '9px', fontWeight: 700, cursor: 'help', verticalAlign: 'middle' as const }

// One "⚠ badge — what it means" line inside a column's help bubble.
const HelpLine = ({ term, children }: { term: string; children: ReactNode }) => (
  <div style={{ marginTop: '8px' }}>
    <strong style={{ color: '#1d1d1f' }}>{term}</strong>
    <div style={{ color: '#6e6e73', marginTop: '2px' }}>{children}</div>
  </div>
)

// Plain-English explanations of the flags and actions in the visitor log,
// shown by the "?" next to the Phone / Email / ✓ column headers.
const COLUMN_HELP: Record<string, ReactNode> = {
  phone: (
    <>
      <div style={{ fontWeight: 700 }}>Phone labels</div>
      <div style={{ color: '#6e6e73', marginTop: '4px' }}>
        We check what kind of number each visitor gave you, so you know how to reach them again.
      </div>
      <HelpLine term="📱 Mobile">
        A regular carrier cell line. Texts reach it, so this is the number to follow up on.
      </HelpLine>
      <HelpLine term="☎ Home phone">
        A house or office line — a landline, or home phone service from a cable company. It
        can&apos;t receive text messages, so their codeword only reached them by email. Follow up with
        a phone call or an email.
      </HelpLine>
      <HelpLine term="⚠ VoIP">
        An internet phone number (Google Voice, TextNow, and similar) instead of a regular carrier
        mobile line. Plenty of people use them for real — but they&apos;re free and quick to create
        anonymously, so it&apos;s a reasonable prompt to ask for photo ID at the door.
      </HelpLine>
      <HelpLine term="⚠ undelivered">
        The carrier rejected the codeword text. Usually a mistyped number, a landline, or a
        disconnected line — so this visitor never got their codeword by text.
      </HelpLine>
      <HelpLine term="🚫 Opted out">
        This number replied STOP to a text. By law they can&apos;t be texted again unless they reply
        START, so follow up by phone call or email instead.
      </HelpLine>
    </>
  ),
  email: (
    <>
      <div style={{ fontWeight: 700 }}>Email flags</div>
      <HelpLine term="⚠ bounced">
        The codeword email couldn&apos;t be delivered — the address doesn&apos;t exist, was mistyped,
        or the mailbox is full or blocking us. It also appears if they marked the email as spam.
        Treat the address as bad and get a better one before you follow up.
      </HelpLine>
    </>
  ),
  verified: (
    <>
      <div style={{ fontWeight: 700 }}>Verifying a visitor</div>
      <HelpLine term="What it means">
        Your own confirmation that you actually met this person at the door. The codeword proves the
        phone or email they gave you is real; verifying is you confirming the person in front of you
        is the one who registered. Only you can set it — visitors can&apos;t.
      </HelpLine>
      <HelpLine term="When">
        As they walk in, right after they show you their codeword (and ID, if you ask for one).
      </HelpLine>
      <HelpLine term="How">
        Tap <strong>Verify</strong>{' '}on their row — or open the visitor and tap &ldquo;Mark as verified
        at door.&rdquo; Tap again to undo. Verified visitors count toward the &ldquo;Verified at
        Door&rdquo; number at the top of your dashboard.
      </HelpLine>
    </>
  ),
}

const getTimelineBadge = (timeline: string) => {
  const c = timelineStyle(timeline)
  return <span style={{ background: c.bg, color: c.color, padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{timeline}</span>
}

// A code-word delivery failed if the provider reported a hard failure. Used
// to flag bad visitor contact info (bounced email / undeliverable SMS).
const deliveryFlag = (status: string | null | undefined): boolean =>
  status === 'bounced' || status === 'complained' || status === 'undelivered' || status === 'failed'
const deliveryBadgeStyle = { marginLeft: '6px', background: '#fff0f0', color: '#cc0000', border: '1px solid #f0c0c0', borderRadius: '6px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' as const }
const optedOutBadgeStyle = { marginLeft: '6px', background: '#f2f2f7', color: '#6e6e73', border: '1px solid #d1d1d6', borderRadius: '6px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' as const }
// Codeword went by WhatsApp (lib/messaging-channel.ts) rather than SMS.
const whatsAppBadgeStyle = { marginLeft: '6px', background: '#e9f9ee', color: '#1a7f37', border: '1px solid #b7e4c4', borderRadius: '6px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' as const }
// Agreement chips — only shown when the open house requires a signed
// agreement (migration 043). "Not signed" is a door-side prompt for the
// host, deliberately amber (a nudge), never red (an accusation).
const signedBadgeStyle = { marginLeft: '6px', background: '#e8f9ee', color: '#1a7a3c', border: '1px solid #b2f0c8', borderRadius: '6px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' as const }
const unsignedBadgeStyle = { marginLeft: '6px', background: '#fff8e6', color: '#8a6100', border: '1px solid #f0d896', borderRadius: '6px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' as const }
// Line-type chips: mobile and home phone are neutral facts (same grey as the
// opted-out chip), only the burner-app signal is amber.
const lineChipStyle = {
  plain: { marginLeft: '6px', background: '#f2f2f7', color: '#6e6e73', border: '1px solid #d1d1d6', borderRadius: '6px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' as const },
  warn: { marginLeft: '6px', background: '#fff8e6', color: '#8a6100', border: '1px solid #f0d896', borderRadius: '6px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' as const },
}

// The one chip that describes what kind of phone number this is. Nothing is
// shown when Twilio's lookup came back empty or with a type we don't label.
const PhoneLineChip = ({ lineType }: { lineType: string | null | undefined }) => {
  const kind = phoneLineKind(lineType)
  if (!kind) return null
  const chip = PHONE_LINE_CHIPS[kind]
  return <span title={chip.tip} style={lineChipStyle[chip.tone]}>{chip.label}</span>
}

// Derive an open house's lifecycle state from its schedule, since the stored
// `status` is only ever 'active' and never transitions. Falls back to the
// free-text date for legacy rows without start/end times, then to the stored
// status as a last resort.
const ohState = (oh: { status?: string | null; start_at?: string | null; end_at?: string | null; open_house_date?: string | null }): 'upcoming' | 'live' | 'ended' => {
  const now = Date.now()
  const start = oh.start_at ? new Date(oh.start_at).getTime() : NaN
  const end = oh.end_at ? new Date(oh.end_at).getTime() : NaN
  if (!Number.isNaN(end)) {
    if (now > end) return 'ended'
    if (!Number.isNaN(start) && now < start) return 'upcoming'
    return 'live'
  }
  if (oh.open_house_date) {
    const t = Date.parse(oh.open_house_date)
    if (!Number.isNaN(t)) {
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
      if (t < startOfToday.getTime()) return 'ended'
      if (t > startOfToday.getTime()) return 'upcoming'
      return 'live'
    }
  }
  return oh.status === 'active' ? 'live' : 'ended'
}
const OH_BADGE: Record<'upcoming' | 'live' | 'ended', { bg: string; color: string; dot: string; label: string }> = {
  upcoming: { bg: '#e5f0ff', color: '#0040a0', dot: '#0071e3', label: 'Upcoming' },
  live: { bg: '#e8f9ee', color: '#1a7a3c', dot: '#30d158', label: 'Live' },
  ended: { bg: '#f2f2f7', color: '#6e6e73', dot: '#aeaeb2', label: 'Ended' },
}

function TrialBanner({ agentId, supabase, accentColor, trialLimit }: { agentId: string, supabase: any, accentColor: string, trialLimit: number }) {
  const [count, setCount] = useState<number>(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { count: c } = await supabase
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId)
      setCount(c || 0)
      setLoaded(true)
    }
    if (agentId) load()
  }, [agentId])

  if (!loaded) return null

  // The cap is 25 plus any admin-gifted bonus visitors; warn when ~7 remain
  // (same margin the stock 18-of-25 warning used).
  const remaining = Math.max(0, trialLimit - count)
  const isExpired = count >= trialLimit
  const isWarning = count >= trialLimit - 7

  return (
    <div style={{
      background: isExpired ? '#fff0f0' : isWarning ? '#fff9e0' : '#e8f9ee',
      border: `1px solid ${isExpired ? '#ffcccc' : isWarning ? '#ffe066' : '#b2f0c8'}`,
      borderRadius: '12px',
      padding: '12px 16px',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#1d1d1f' }}>
          {isExpired
            ? '⚠️ Your free trial has ended'
            : `✓ Free trial — ${remaining} of ${trialLimit} visitor registrations remaining`
          }
        </div>
        <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '2px' }}>
          {isExpired
            ? 'Upgrade to Pro to continue receiving visitor registrations.'
            : isWarning
            ? 'Running low! Upgrade to Pro for unlimited registrations.'
            : 'Full Pro features included during your trial. No credit card required.'}
        </div>
      </div>
      <a href="/dashboard?view=settings" style={{
        background: '#1d1d1f',
        color: 'white',
        padding: '7px 16px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '700',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        flexShrink: 0
      }}>
        {isExpired ? 'Upgrade now →' : 'View plans'}
      </a>
    </div>
  )
}

export default function OpenHouseList({
  user,
  openHouses,
  selectedOH,
  visitors,
  isPaidTier,
  sponsored,
  trialLimit,
  locked,
  primaryColor,
  onPrimary,
  primaryBtnBorder,
  accentColor,
  onAccent,
  accentBtnBorder,
  accentText,
  setSelectedOH,
  loadVisitors,
  guardLocked,
  startEdit,
  startCopy,
  exportCSV,
  toggleVerified,
  setView,
  setEditingOH,
  resetForm,
  setQrModal,
  openPermanentQr,
  openSellerReport,
  openInvites,
  setDeleteConfirm,
  setVisitorModal,
  showToast,
}: {
  user: any
  openHouses: any[]
  selectedOH: any
  visitors: any[]
  isPaidTier: boolean
  sponsored: boolean
  trialLimit: number
  locked: boolean
  primaryColor: string
  onPrimary: string
  primaryBtnBorder: string
  accentColor: string
  onAccent: string
  accentBtnBorder: string
  accentText: string
  setSelectedOH: (oh: any) => void
  loadVisitors: (openHouseId: string) => Promise<void>
  guardLocked: () => boolean
  startEdit: (oh: any) => void
  startCopy: (oh: any) => void
  exportCSV: () => void
  toggleVerified: (visitorId: string, current: boolean) => void
  setView: (v: 'dashboard' | 'new' | 'settings' | 'team' | 'activity') => void
  setEditingOH: (oh: any) => void
  resetForm: () => void
  setQrModal: (v: any) => void
  openPermanentQr: () => Promise<void>
  openSellerReport: (ohId: string) => Promise<void>
  openInvites: (oh: any) => void
  setDeleteConfirm: (id: string | null) => void
  setVisitorModal: (v: any) => void
  showToast: (message: string, type?: 'success' | 'error') => void
}) {
  const visitorSort = useSortable('time', 'desc')
  const sortedVisitors = useMemo(
    () => applySort(visitors, VISITOR_ACC[visitorSort.state.key] || VISITOR_ACC.time, visitorSort.state.dir),
    [visitors, visitorSort.state]
  )

  return (
    <>
      <div style={{ fontSize: '24px', fontWeight: '600', color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>Dashboard</div>
      <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '16px' }}>Real-time visitor log and open house management.</div>

      {/* Hidden for sponsored agents even if the sponsor's billing isn't
          active yet (Dave's call) — a sponsored account shouldn't see trial
          nags. If the sponsorship ends (either side), sponsored flips false
          and the banner returns with the live remaining count. */}
      {!isPaidTier && !locked && !sponsored && (
        <TrialBanner agentId={user?.id} supabase={supabase} accentColor={accentColor} trialLimit={trialLimit} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Active Open Houses', value: openHouses.filter(oh => ohState(oh) !== 'ended').length },
          { label: 'Total Registrations', value: visitors.length, accent: true },
          { label: 'Verified at Door', value: visitors.filter(v => v.verified).length }
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '16px 18px' }}>
            <div style={{ fontSize: '11px', fontWeight: '500', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{stat.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '600', color: stat.accent ? accentText : '#1d1d1f', letterSpacing: '-1px' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f' }}>Your open houses</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button disabled={locked} onClick={() => { if (guardLocked()) return; openPermanentQr() }} title="One QR code that always points to your next open house — print it once, reuse it forever" style={{ background: primaryColor, color: onPrimary, border: primaryBtnBorder, padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            📌 My QR code
          </button>
          <button disabled={locked} onClick={() => { if (guardLocked()) return; setEditingOH(null); resetForm(); setView('new') }} style={{ background: accentColor, color: onAccent, border: accentBtnBorder, padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            + New open house
          </button>
        </div>
      </div>

      {openHouses.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '40px', textAlign: 'center', color: '#6e6e73', marginBottom: '20px' }}>
          No open houses yet. Create your first one!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {openHouses.map(oh => (
            <div key={oh.id} style={{ background: 'white', border: `1px solid ${selectedOH?.id === oh.id ? accentText : '#d1d1d6'}`, borderRadius: '18px', padding: '14px 18px', cursor: 'pointer' }}
              onClick={async () => { setSelectedOH(oh); await loadVisitors(oh.id) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: OH_BADGE[ohState(oh)].dot, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{oh.property_address}</div>
                  <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '2px' }}>{oh.open_house_date} · {oh.open_house_hours} · 📱 <strong>{oh.code_word}</strong> · ✉️ <strong>{oh.code_word_email || oh.code_word}</strong></div>
                </div>
                {(() => { const b = OH_BADGE[ohState(oh)]; return (
                  <div style={{ background: b.bg, color: b.color, fontSize: '11px', fontWeight: '600', padding: '3px 9px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: b.dot }} />{b.label}
                  </div>
                )})()}
              </div>
              {/* Scrolls sideways like the visitor log below: on a phone these
                  six actions are wider than the card, and without this the
                  ones on the right (Edit, Delete) are simply unreachable. */}
              <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any, paddingBottom: '2px' }} onClick={e => e.stopPropagation()}>
                <button disabled={locked} onClick={async (e) => {
                  e.stopPropagation()
                  if (guardLocked()) return
                  const url = `${window.location.origin}/register/${oh.id}`
                  const res = await fetch(`/api/qrcode?url=${encodeURIComponent(url)}`)
                  const blob = await res.blob()
                  const dataUrl = await new Promise<string>(resolve => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(reader.result as string)
                    reader.readAsDataURL(blob)
                  })
                  setQrModal({ oh, url, dataUrl, blob })
                }} style={{ background: accentColor, color: onAccent, border: accentBtnBorder, borderRadius: '6px', padding: '5px 8px', fontSize: '10px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>📱 QR Code</button>
                <button disabled={locked} onClick={(e) => {
                  e.stopPropagation()
                  if (guardLocked()) return
                  const url = `${window.location.origin}/register/${oh.id}`
                  navigator.clipboard.writeText(url)
                  showToast('Registration URL copied!')
                }} style={{ background: primaryColor, color: onPrimary, border: primaryBtnBorder, borderRadius: '6px', padding: '5px 8px', fontSize: '10px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>📋 Copy URL</button>
                {ohState(oh) !== 'ended' && (
                  <button disabled={locked} onClick={(e) => { e.stopPropagation(); if (guardLocked()) return; openInvites(oh) }} title="Email the past visitors who are still in their buying window a personal invite to this open house" style={{ background: accentColor, color: onAccent, border: accentBtnBorder, borderRadius: '6px', padding: '5px 8px', fontSize: '10px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>💌 Invite</button>
                )}
                <button disabled={locked} onClick={(e) => { e.stopPropagation(); startCopy(oh) }} title="Start a new open house with these same details — just pick the new date and times" style={{ background: '#f5f5f7', color: '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '6px', padding: '5px 8px', fontSize: '10px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>⧉ Duplicate</button>
                <button disabled={locked} onClick={(e) => { e.stopPropagation(); startEdit(oh) }} style={{ background: '#f5f5f7', color: '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '6px', padding: '5px 8px', fontSize: '10px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>✏️ Edit</button>
                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(oh.id) }} style={{ background: '#fff0f0', color: '#cc0000', border: '1px solid #ffcccc', borderRadius: '6px', padding: '5px 8px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>🗑 Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedOH && (
        <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f' }}>Visitor log — {selectedOH.property_address}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button disabled={locked} onClick={() => { if (guardLocked()) return; openSellerReport(selectedOH.id) }} title="A shareable results page for your seller — visitor counts and buyer timelines, no visitor contact info" style={{ background: accentColor, color: onAccent, border: accentBtnBorder, padding: '6px 13px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>📊 Seller report</button>
              <button disabled={locked} onClick={exportCSV} style={{ background: primaryColor, color: onPrimary, border: primaryBtnBorder, padding: '6px 13px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Export CSV</button>
            </div>
          </div>
          {visitors.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6e6e73', padding: '20px', fontSize: '13px' }}>No visitors yet. Share your QR code to get started!</div>
          ) : (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '500px' }}>
                <thead>
                  <tr>
                    {VISITOR_COLUMNS.map(col => {
                      const active = visitorSort.state.key === col.key
                      return (
                        <th key={col.key} onClick={() => visitorSort.onSort(col.key)} title="Sort" style={{ textAlign: 'left', padding: '8px', fontSize: '10px', fontWeight: '600', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #d1d1d6', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                          {col.label}
                          <span style={{ marginLeft: '4px', fontSize: '9px', color: active ? '#1d1d1f' : '#c7c7cc' }}>{active ? (visitorSort.state.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          {COLUMN_HELP[col.key] && (
                            <Tip body={COLUMN_HELP[col.key]}><span style={helpIconStyle}>?</span></Tip>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedVisitors.map((v, i) => (
                    <tr key={v.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f2f2f7', whiteSpace: 'nowrap' }}>
                        <Tip width={220} body={<><strong>{langMeta(v.lang).label}</strong><div style={{ color: '#6e6e73', marginTop: '2px' }}>The language this visitor signed in with — the one to greet and follow up in.</div></>}>
                          <span style={{ cursor: 'help' }}>{langMeta(v.lang).flag}</span>
                        </Tip>
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f2f2f7', whiteSpace: 'nowrap' }}>
                        <button onClick={() => setVisitorModal(v)} style={{ background: 'none', border: 'none', padding: 0, color: accentText, fontWeight: 600, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '12px', textAlign: 'left' }}>
                          {v.first_name} {v.last_name}
                        </button>
                        {v.notes && (
                          <Tip width={260} body={<><strong>Notes</strong><div style={{ color: '#6e6e73', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{v.notes}</div></>}>
                            <span style={{ cursor: 'help', marginLeft: '4px' }}>📝</span>
                          </Tip>
                        )}
                        {selectedOH?.require_agreement && (v.agreement_signed
                          ? <span title="Signed the required agreement — copies were emailed to you both" style={signedBadgeStyle}>✍ Signed</span>
                          : <span title="Hasn't signed the required agreement — ask before letting them tour" style={unsignedBadgeStyle}>✍ Not signed</span>)}
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f2f2f7', color: '#6e6e73', whiteSpace: 'nowrap' }}>{v.phone}{v.sms_opted_out ? <span title="This number replied STOP — do not contact" style={optedOutBadgeStyle}>🚫 Opted out</span> : deliveryFlag(v.sms_status) ? <span title={v.codeword_channel === 'whatsapp' ? 'WhatsApp message could not be delivered to this number' : 'Text could not be delivered to this number'} style={deliveryBadgeStyle}>⚠ undelivered</span> : v.codeword_channel === 'whatsapp' ? <span title="Codeword was sent by WhatsApp, not SMS" style={whatsAppBadgeStyle}>WhatsApp</span> : null}<PhoneLineChip lineType={v.phone_line_type} /></td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f2f2f7', color: '#6e6e73', whiteSpace: 'nowrap' }}>{v.email}{deliveryFlag(v.email_status) && <span title="Email bounced — this address may be invalid" style={deliveryBadgeStyle}>⚠ bounced</span>}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f2f2f7', whiteSpace: 'nowrap' }}>{getTimelineBadge(v.purchasing_timeline)}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f2f2f7', color: '#6e6e73', whiteSpace: 'nowrap' }}>{new Date(v.registered_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f2f2f7', whiteSpace: 'nowrap' }}>
                        <button disabled={locked} onClick={() => toggleVerified(v.id, v.verified)} style={{ background: v.verified ? '#30d158' : primaryColor, color: v.verified ? 'white' : onPrimary, border: v.verified ? 'none' : primaryBtnBorder, borderRadius: '6px', padding: '4px 8px', fontSize: '10px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
                          {v.verified ? '✓' : 'Verify'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  )
}
