'use client'
import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import { fillBorder } from '@/lib/colors'
import { isLegacyTwoYear, isComped, isExpiredPrepaidAccess, trialLimitFor } from '@/lib/billing-plans'
import { normalizeAgreementTemplates, MAX_AGREEMENT_TEMPLATES } from '@/lib/agreements'

// The Settings view: subscription/billing, agent profile, branding & photos,
// brand colors, CRM lead-intake, and the Zapier webhook. Presentational —
// profile state, formatPhone, and saveSettings live in page.tsx and pass in
// as props. SubscriptionSection (billing UI) lives here since only this view
// uses it.

const BILLING_OPTIONS = [
  { key: 'month',           label: 'Monthly' },
  { key: 'year',            label: 'Annual' },
  { key: 'two_year_prepay', label: '2 Years*' },
] as const

// Flip to false to retire the limited-time 2-year prepay offer. Existing
// 2-year subscribers keep their plan; it just stops being offered to new/
// renewing agents (and the toggle option disappears).
const OFFER_TWO_YEAR = true

type BillingKey = typeof BILLING_OPTIONS[number]['key']

const PLAN_TIERS: {
  name: string
  tier: 'pro' | 'team' | 'brokerage'
  featured: boolean
  price: Record<BillingKey, string>
  per: string
  sub: Record<BillingKey, string>
  cta: string
}[] = [
  {
    name: 'Pro', tier: 'pro', featured: true,
    price: { month: '$15', year: '$12.50', two_year_prepay: '$10' }, per: '/mo',
    sub: { month: 'For the active agent', year: '$150/yr — 2 months free', two_year_prepay: '$240 every 2 yrs — year 2 half off' },
    cta: 'Upgrade to Pro',
  },
  {
    name: 'Team', tier: 'team', featured: false,
    price: { month: '$120', year: '$100', two_year_prepay: '$80' }, per: '/mo',
    sub: { month: 'For 2–10 agents', year: '$1,200/yr — 2 months free', two_year_prepay: '$1,920 every 2 yrs — year 2 half off' },
    cta: 'Start Team',
  },
  {
    name: 'Brokerage', tier: 'brokerage', featured: false,
    price: { month: '$11', year: '$110', two_year_prepay: '$176' }, per: '/agent',
    sub: { month: '11–100 agents · add seats anytime', year: '11–100 agents — 2 months free', two_year_prepay: '11–100 agents — year 2 half off' },
    cta: 'Start Brokerage',
  },
]

function formatPlanDate(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return '' }
}

function intervalLabel(interval: string | null | undefined): string {
  if (interval === 'month') return 'Monthly'
  if (interval === 'year') return 'Annual'
  if (interval === 'two_year_prepay') return '2-Year'
  if (interval === 'comped') return 'Gifted'
  return ''
}

function SubscriptionSection({ profile, agentId, supabase, showToast, onChanged }: {
  profile: any
  agentId: string
  supabase: any
  showToast: (m: string, t?: 'success' | 'error') => void
  onChanged?: () => void | Promise<void>
}) {
  const [visitorCount, setVisitorCount] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [planBilling, setPlanBilling] = useState<BillingKey>('month')
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const tier = profile?.tier || 'free'
  const isFree = tier === 'free'
  const isPaid = ['pro', 'team', 'brokerage'].includes(tier)
  const status = profile?.subscription_status as string | null
  const canceledAt = profile?.subscription_canceled_at as string | null
  const periodEnd = profile?.current_period_end as string | null
  const billing = profile?.billing_interval as string | null

  // A LEGACY 2-year prepay or an admin comp (gifted access) — both paid with
  // no subscription — still reads paid/active after the access date passes.
  // Treat that as expired so the agent sees the plan picker. Real subs auto-renew.
  const prepaidExpired = isExpiredPrepaidAccess(profile)
  // Show the plan picker for free agents AND at the "renew" moment (expired prepaid/gift).
  const showPlans = isFree || prepaidExpired
  // cancel_at_period_end keeps status 'active' until the period closes;
  // canceledAt is our flag that an end is already scheduled.
  const pendingCancel = !!canceledAt && (status === 'active' || status === 'trialing')
  // Any real subscription can be canceled at period end — month, year, and the
  // auto-renewing 2-year alike. Legacy prepays have no sub id (nothing to cancel).
  const canCancel = isPaid && !prepaidExpired && !!profile?.stripe_subscription_id
  const billingChoices = OFFER_TWO_YEAR
    ? BILLING_OPTIONS
    : BILLING_OPTIONS.filter(b => b.key !== 'two_year_prepay')

  useEffect(() => {
    if (!isFree || !agentId) return
    supabase
      .from('visitors')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .then(({ count }: { count: number | null }) => setVisitorCount(count || 0))
  }, [agentId, isFree, supabase])

  const startCheckout = async (tier: string, interval: string) => {
    // Brokerage is per-seat (11–100 agents): ask how many seats to start with.
    // Seats are adjustable anytime afterward from the Team tab. 100+ = sales.
    let seats: number | undefined
    if (tier === 'brokerage') {
      const raw = window.prompt('How many agents? (11–100 — you can add or remove seats anytime)', '11')
      if (raw == null) return // canceled
      seats = Number(raw)
      if (!Number.isInteger(seats) || seats < 11 || seats > 100) {
        showToast(seats > 100 ? 'For more than 100 agents, contact us at ohaccess.com/contact.' : 'Brokerage plans cover 11–100 agents.', 'error')
        return
      }
    }
    setBusy(tier)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { showToast('Please sign in again.', 'error'); setBusy(null); return }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tier, interval, ...(seats ? { seats } : {}) }),
      })
      const json = await res.json()
      if (!res.ok || !json.url) {
        showToast(json.error || 'Could not start checkout.', 'error')
        setBusy(null)
        return
      }
      window.location.href = json.url
    } catch (e) {
      showToast('Could not start checkout.', 'error')
      setBusy(null)
    }
  }

  const openPortal = async () => {
    setBusy('portal')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { showToast('Please sign in again.', 'error'); setBusy(null); return }
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!res.ok || !json.url) {
        showToast(json.error || 'Could not open billing portal.', 'error')
        setBusy(null)
        return
      }
      window.location.href = json.url
    } catch {
      showToast('Could not open billing portal.', 'error')
      setBusy(null)
    }
  }

  // Cancel at period end (keep access until then) or resume a pending cancel.
  const cancelSub = async (resume: boolean) => {
    setBusy(resume ? 'resume' : 'cancel')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { showToast('Please sign in again.', 'error'); setBusy(null); return }
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ resume }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Could not update subscription.', 'error'); setBusy(null); return }
      showToast(resume
        ? 'Subscription resumed — you’re all set.'
        : 'Your plan is set to cancel at the end of this billing period.')
      setConfirmingCancel(false)
      await onChanged?.()
    } catch {
      showToast('Could not update subscription.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const ghostBtn = (color: string) => ({
    background: 'white', color, border: '1px solid #d1d1d6', borderRadius: '9px',
    padding: '10px 18px', fontSize: '13px', fontWeight: 700,
    cursor: busy ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
    opacity: busy ? 0.6 : 1,
  })

  return (
    <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
      <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Subscription</div>

      {showPlans && (
        <>
          {isFree ? (
            <>
              <div style={{ fontSize: '14px', color: '#1d1d1f', marginBottom: '4px' }}>
                <strong>Plan:</strong> Free trial
              </div>
              <div style={{ fontSize: '14px', color: '#6e6e73', marginBottom: '18px' }}>
                {Math.max(0, trialLimitFor(profile) - visitorCount)} of {trialLimitFor(profile)} visitor registrations remaining
              </div>
            </>
          ) : (
            <div style={{ background: '#fff9e0', border: '1px solid #ffe066', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#8a6400' }}>
                {isComped(profile) ? 'Your complimentary access has ended' : 'Your 2-year plan has ended'}
              </div>
              <div style={{ fontSize: '14px', color: '#6e6e73', marginTop: '3px', lineHeight: '1.5' }}>
                Your {isComped(profile) ? 'complimentary' : 'prepaid'} access ended on {formatPlanDate(periodEnd)}. Choose a plan below to pick up right where you left off — your data is safe.
              </div>
            </div>
          )}

          {/* Billing-interval toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'inline-flex', background: '#f5f5f7', borderRadius: '12px', padding: '4px', gap: '2px', maxWidth: '100%', flexWrap: 'wrap' }}>
              {billingChoices.map(b => (
                <button key={b.key} onClick={() => setPlanBilling(b.key)} style={{ padding: '8px 14px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: '600', background: planBilling === b.key ? '#1d1d1f' : 'transparent', color: planBilling === b.key ? 'white' : '#6e6e73', whiteSpace: 'nowrap' }}>
                  {b.label}
                  {b.key === 'year' && <span style={{ marginLeft: '6px', background: '#30d158', color: 'white', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '10px' }}>2 MOS FREE</span>}
                  {b.key === 'two_year_prepay' && <span style={{ marginLeft: '6px', background: '#c9963a', color: '#1d1d1f', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '10px' }}>BEST VALUE</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Plan cards — wrap responsively so they never overflow the panel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            {PLAN_TIERS.map(plan => (
              <div key={plan.tier} style={{ background: plan.featured ? '#1d1d1f' : 'white', border: plan.featured ? '2px solid #c9963a' : '1px solid #d1d1d6', borderRadius: '14px', padding: '16px 14px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: plan.featured ? 'white' : '#1d1d1f', marginBottom: '4px' }}>{plan.name}</div>
                <div style={{ fontSize: '26px', fontWeight: '700', color: plan.featured ? '#c9963a' : '#1d1d1f', letterSpacing: '-0.5px', lineHeight: '1.1' }}>
                  {plan.price[planBilling]}<span style={{ fontSize: '12px', fontWeight: '400', color: plan.featured ? 'rgba(255,255,255,0.5)' : '#6e6e73' }}>{plan.per}</span>
                </div>
                <div style={{ fontSize: '11px', color: plan.featured ? 'rgba(255,255,255,0.55)' : '#6e6e73', minHeight: '28px', marginTop: '4px', marginBottom: '12px' }}>{plan.sub[planBilling]}</div>
                <button
                  onClick={() => startCheckout(plan.tier, planBilling)}
                  disabled={busy !== null}
                  style={{ marginTop: 'auto', width: '100%', background: plan.featured ? '#c9963a' : '#1d1d1f', color: plan.featured ? '#1d1d1f' : 'white', border: 'none', borderRadius: '9px', padding: '9px', fontSize: '12px', fontWeight: '700', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: busy && busy !== plan.tier ? 0.5 : 1 }}
                >
                  {busy === plan.tier ? 'Loading…' : isFree ? plan.cta : (plan.tier === 'brokerage' ? plan.cta : `Renew ${plan.name}`)}
                </button>
              </div>
            ))}
          </div>
          {OFFER_TWO_YEAR && (
            <div style={{ fontSize: '11px', color: '#6e6e73', marginTop: '10px', fontStyle: 'italic' }}>
              * 2-year pricing is a limited-time founding-member offer — paid upfront, renews automatically every 2 years (we&apos;ll email you before each renewal; cancel anytime). Brokerage plans over 100 agents: <a href="/contact" style={{ color: '#0071e3' }}>contact us</a>.
            </div>
          )}
        </>
      )}

      {isPaid && !showPlans && (
        <>
          <div style={{ fontSize: '14px', color: '#1d1d1f', marginBottom: '4px' }}>
            <strong>Plan:</strong> {tier.charAt(0).toUpperCase() + tier.slice(1)}
            {billing && ` — ${intervalLabel(billing)}`}
          </div>
          <div style={{ fontSize: '14px', color: '#6e6e73', marginBottom: '6px' }}>
            <strong>Status:</strong> {status === 'past_due'
              ? <span style={{ color: '#cc0000' }}>Payment failed — please update your card</span>
              : pendingCancel
              ? <span style={{ color: '#b84800' }}>Canceling — access until {formatPlanDate(periodEnd)}</span>
              : status === 'active' || status === 'trialing'
              ? 'Active'
              : (status || 'Unknown')}
          </div>
          {periodEnd && !pendingCancel && status !== 'past_due' && (
            <div style={{ fontSize: '14px', color: '#6e6e73', marginBottom: '14px' }}>
              {isLegacyTwoYear(profile) || isComped(profile) ? <><strong>Access until:</strong> {formatPlanDate(periodEnd)}</> : <><strong>Renews on:</strong> {formatPlanDate(periodEnd)}</>}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Gifted (comped) accounts have no Stripe customer — nothing to manage. */}
            {profile?.stripe_customer_id && (
            <button
              onClick={openPortal}
              disabled={busy !== null}
              style={{ background: '#1d1d1f', color: 'white', border: 'none', borderRadius: '9px', padding: '10px 18px', fontSize: '13px', fontWeight: '700', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: busy ? 0.6 : 1 }}
            >
              {busy === 'portal' ? 'Loading…' : 'Manage billing →'}
            </button>
            )}
            {pendingCancel ? (
              <button onClick={() => cancelSub(true)} disabled={busy !== null} style={ghostBtn('#1d1d1f')}>
                {busy === 'resume' ? '…' : 'Resume subscription'}
              </button>
            ) : canCancel && !confirmingCancel ? (
              <button onClick={() => setConfirmingCancel(true)} disabled={busy !== null} style={ghostBtn('#cc0000')}>
                Cancel subscription
              </button>
            ) : null}
          </div>

          {confirmingCancel && !pendingCancel && (
            <div style={{ marginTop: '12px', background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.5', marginBottom: '10px' }}>
                You&apos;ll keep full access until <strong>{formatPlanDate(periodEnd)}</strong>. After that your plan won&apos;t renew and you won&apos;t be charged again. You can resume anytime before then.
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => cancelSub(false)} disabled={busy !== null} style={{ background: '#cc0000', color: 'white', border: 'none', borderRadius: '9px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: busy ? 0.6 : 1 }}>
                  {busy === 'cancel' ? '…' : 'Yes, cancel'}
                </button>
                <button onClick={() => setConfirmingCancel(false)} disabled={busy !== null} style={{ background: '#f5f5f7', color: '#1d1d1f', border: 'none', borderRadius: '9px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Keep my plan
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// "Refer an agent" — shown to EVERY agent (Dave's call, 2026-07): tracking is
// decoupled from reward, so free and team/brokerage agents can share their
// link and referrals accrue under their code. Only the reward wording varies:
// self-paid Pro agents earn credit now; everyone else banks it until they're
// on their own Pro plan. The link is created lazily on first open of Settings
// and is stable forever after.
function ReferralSection({ profile }: { profile: any }) {
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const earnsCreditNow = profile?.tier === 'pro' && !isExpiredPrepaidAccess(profile)

  useEffect(() => {
    if (link) return
    let cancelled = false
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const res = await fetch('/api/referral-link', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.shortUrl) setLink(data.shortUrl)
      } catch { /* card just stays hidden on failure */ }
    }
    load()
    return () => { cancelled = true }
  }, [link])

  if (!link) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable — the link is still selectable */ }
  }

  // Share buttons open the AGENT'S own mail/messages app with a pre-written
  // note — the invite comes from them personally (converts better) and never
  // touches our email domain (protects code-word deliverability).
  const shareMessage = `I've been using ohACCESS to run verified open-house sign-ins — visitors scan a QR code and I get clean, verified leads with no paper sheet. Here's my link if you want to try it: ${link}`
  const mailHref = `mailto:?subject=${encodeURIComponent('Try ohACCESS for your open houses')}&body=${encodeURIComponent(shareMessage)}`
  // `?&body=` is the cross-platform form both iOS and Android accept.
  const smsHref = `sms:?&body=${encodeURIComponent(shareMessage)}`
  const shareBtnStyle: CSSProperties = { display: 'inline-block', background: '#f5f5f7', color: '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '9px', padding: '10px 14px', fontSize: '13px', fontWeight: '700', textDecoration: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif" }

  return (
    <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
      <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f', marginBottom: '8px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>
        🎁 Refer an Agent
      </div>
      <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.6', marginBottom: '12px' }}>
        {earnsCreditNow ? (
          <>Share your personal link with other agents. When someone you refer becomes a paying ohACCESS subscriber, you earn <strong style={{ color: '#1d1d1f' }}>a free month of Pro</strong> — added onto your annual or 2-year plan, or a $15 credit on your next bill if you&apos;re month-to-month.</>
        ) : (
          <>Share your personal link with other agents. When someone you refer becomes a paying ohACCESS subscriber, you earn <strong style={{ color: '#1d1d1f' }}>a free month of Pro</strong> — banked for you and applied once you&apos;re on your own Pro plan.</>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          style={{ flex: '1 1 220px', background: '#f5f5f7', border: '1px solid #d1d1d6', borderRadius: '9px', padding: '10px 12px', fontSize: '13px', color: '#1d1d1f', fontFamily: 'monospace' }}
        />
        <button
          onClick={copy}
          style={{ background: '#1d1d1f', color: 'white', border: 'none', borderRadius: '9px', padding: '10px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
        <a href={mailHref} style={shareBtnStyle}>✉️ Email it</a>
        <a href={smsHref} style={shareBtnStyle}>💬 Text it</a>
      </div>
    </div>
  )
}

// Shown at the TOP of Settings — where the plan card would sit — when the
// agent has a sponsor (a 3rd-party provider whose card rides below theirs in
// visitor emails). Mirrors the gold "Sponsored by" card visitors see in
// emails so the agent knows exactly what's being shown. While the sponsor's
// billing is active the agent's account runs as full Pro, so this card
// REPLACES the plan/upgrade card entirely. The agent accepted this via the
// emailed invite; this card lets them see who it is and end it anytime.
function SponsorshipSection({ profile, setProfile, agentId, showToast, sponsorCovered, onEnded }: {
  profile: any
  setProfile: (p: any) => void
  agentId: string
  showToast: (message: string, type?: 'success' | 'error') => void
  sponsorCovered: boolean
  onEnded: () => void | Promise<void>
}) {
  const [sponsor, setSponsor] = useState<{
    full_name: string | null
    company: string | null
    display_email: string | null
    phone: string | null
    license_number: string | null
    headshot_url: string | null
    logo_url: string | null
  } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!profile?.sponsor_id) return
    supabase
      .from('sponsors')
      .select('full_name, company, display_email, phone, license_number, headshot_url, logo_url')
      .eq('id', profile.sponsor_id)
      .maybeSingle()
      .then(({ data }: { data: typeof sponsor }) => setSponsor(data))
  }, [profile?.sponsor_id])

  const endSponsorship = async () => {
    setBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({ sponsor_id: null })
      .eq('id', agentId)
    setBusy(false)
    setConfirming(false)
    if (error) {
      showToast('Could not end the sponsorship. Please try again.', 'error')
      return
    }
    setProfile({ ...profile, sponsor_id: null })
    showToast('Sponsorship ended.')
    await onEnded()
  }

  return (
    <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
      <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Sponsorship</div>

      {sponsorCovered && (
        <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.5', marginBottom: '14px' }}>
          ✓ <strong style={{ color: '#1d1d1f' }}>Pro — included with your sponsorship.</strong> Your sponsor covers your plan; there&apos;s nothing for you to pay.
        </div>
      )}

      {/* The sponsor's card, styled to match the one visitors see in emails. */}
      <div style={{ background: '#fdfaf3', border: '1px solid #ead9ad', borderRadius: '10px', padding: '14px', maxWidth: '460px' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: '#8a6a1f', textTransform: 'uppercase' as const, letterSpacing: '1px', marginBottom: '10px' }}>Sponsored by</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {sponsor?.headshot_url && (
            <img src={sponsor.headshot_url} alt="Sponsor headshot" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #ead9ad', marginRight: '16px' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          )}
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1d1d1f' }}>{sponsor?.full_name || '…'}</div>
            {sponsor?.company && <div style={{ fontSize: '12px', color: '#6e6e73' }}>{sponsor.company}</div>}
            {sponsor?.display_email && <div style={{ fontSize: '12px', color: '#0071e3' }}>{sponsor.display_email}</div>}
            {sponsor?.phone && <div style={{ fontSize: '12px', color: '#6e6e73' }}>{sponsor.phone}</div>}
            {sponsor?.license_number && <div style={{ fontSize: '11px', color: '#6e6e73' }}>{sponsor.license_number}</div>}
          </div>
        </div>
        {sponsor?.logo_url && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #ead9ad', textAlign: 'center' as const }}>
            <img src={sponsor.logo_url} alt="Sponsor logo" style={{ maxHeight: '60px', width: '70%', objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '14px', flexWrap: 'wrap' as const }}>
        <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.6', flex: '1 1 280px' }}>
          This card appears below yours in visitor emails, and your sign-in form names them in the consent language. Your branding — logo, colors, and name — stays fully yours.
        </div>
        {confirming ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: '14px', color: '#6e6e73' }}>{sponsorCovered ? 'End sponsorship? Your Pro coverage through them ends too.' : 'End sponsorship?'}</span>
            <button onClick={endSponsorship} disabled={busy} style={{ background: '#cc0000', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: busy ? 0.7 : 1 }}>
              {busy ? '…' : 'Yes, end it'}
            </button>
            <button onClick={() => setConfirming(false)} style={{ background: 'none', border: 'none', color: '#6e6e73', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} style={{ background: 'white', border: '1px solid #d1d1d6', color: '#cc0000', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            End sponsorship
          </button>
        )}
      </div>
    </div>
  )
}

export default function SettingsPanel({
  profile,
  setProfile,
  agentId,
  showToast,
  onSubscriptionChanged,
  isTeamMember,
  teamPaymentFailed,
  isTeamAdmin,
  sponsorCovered,
  formatPhone,
  saveSettings,
  primaryColor,
  onPrimary,
  primaryBtnBorder,
  accentColor,
  onAccent,
  accentBtnBorder,
  inputStyle,
  labelStyle,
}: {
  profile: any
  setProfile: (p: any) => void
  agentId: string
  showToast: (message: string, type?: 'success' | 'error') => void
  onSubscriptionChanged: () => void | Promise<void>
  isTeamMember: boolean
  teamPaymentFailed: boolean
  isTeamAdmin: boolean
  sponsorCovered: boolean
  formatPhone: (value: string) => string
  saveSettings: () => void
  primaryColor: string
  onPrimary: string
  primaryBtnBorder: string
  accentColor: string
  onAccent: string
  accentBtnBorder: string
  inputStyle: CSSProperties
  labelStyle: CSSProperties
}) {
  // The shared dashboard input/label styles read small on a standard MacBook
  // (Dave's feedback), so Settings bumps them one notch locally. Parameter
  // reassignment on purpose: every use below picks up the larger versions
  // without touching the other dashboard views.
  inputStyle = { ...inputStyle, fontSize: '14px' }
  labelStyle = { ...labelStyle, fontSize: '12px' }

  // Whether the agent carries their OWN active paid plan (as opposed to Pro
  // access granted by a sponsor's billing). Decides if the Subscription card
  // still shows underneath the sponsor card.
  const ownPaidActive =
    ['pro', 'team', 'brokerage'].includes(profile?.tier || 'free') && !isExpiredPrepaidAccess(profile)

  // Disclosure/notice rows live in `profile` like every other setting, so the
  // existing saveSettings picks them up. Rows are kept as typed (including
  // half-finished ones) and only validated/cleaned on save.
  // Agreement templates (migration 043): the agent's uploaded blank forms for
  // the "signed agreement before entry" step. Unlike everything else in this
  // panel these save IMMEDIATELY through /api/agreement-templates (a file
  // upload can't ride the profiles.update() whitelist), so the Save settings
  // button is not involved; the API updates profiles.agreement_templates and
  // we mirror its response into local profile state.
  const agreementTemplates = normalizeAgreementTemplates(profile?.agreement_templates)
  const [agreementLabel, setAgreementLabel] = useState('')
  const [agreementFile, setAgreementFile] = useState<File | null>(null)
  const [agreementBusy, setAgreementBusy] = useState(false)
  // Remount the bare <input type="file"> after each upload — file inputs
  // can't be programmatically cleared through React state.
  const [agreementFileKey, setAgreementFileKey] = useState(0)

  const agreementAuthHeaders = async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  const uploadAgreementTemplate = async () => {
    if (!agreementFile) { showToast('Choose a PDF file first', 'error'); return }
    if (!agreementLabel.trim()) { showToast('Give the document a name visitors will see', 'error'); return }
    setAgreementBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', agreementFile)
      fd.append('label', agreementLabel.trim())
      const res = await fetch('/api/agreement-templates', {
        method: 'POST',
        headers: await agreementAuthHeaders(),
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Upload failed. Please try again.', 'error'); return }
      setProfile({ ...profile, agreement_templates: [...agreementTemplates, json.template] })
      setAgreementLabel('')
      setAgreementFile(null)
      setAgreementFileKey(k => k + 1)
      showToast('Document uploaded!')
    } catch {
      showToast('Upload failed. Please try again.', 'error')
    } finally {
      setAgreementBusy(false)
    }
  }

  const deleteAgreementTemplate = async (id: string) => {
    setAgreementBusy(true)
    try {
      const res = await fetch('/api/agreement-templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(await agreementAuthHeaders()) },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Could not delete the document.', 'error'); return }
      const remaining = agreementTemplates.filter(t => t.id !== id)
      setProfile({ ...profile, agreement_templates: remaining.length > 0 ? remaining : null })
      showToast('Document deleted.')
    } catch {
      showToast('Could not delete the document.', 'error')
    } finally {
      setAgreementBusy(false)
    }
  }

  const disclosureRows: { label: string; url: string }[] =
    Array.isArray(profile?.disclosure_links) ? profile.disclosure_links : []
  const setDisclosureRows = (rows: { label: string; url: string }[]) =>
    setProfile({ ...profile, disclosure_links: rows })
  const addDisclosureRow = () => setDisclosureRows([...disclosureRows, { label: '', url: '' }])
  const removeDisclosureRow = (i: number) =>
    setDisclosureRows(disclosureRows.filter((_, idx) => idx !== i))
  const updateDisclosureRow = (i: number, row: { label: string; url: string }) =>
    setDisclosureRows(disclosureRows.map((r, idx) => (idx === i ? row : r)))

  // Custom questions, also stored on `profile`. Ids are minted here and never
  // change, so an answer already recorded against a question stays linked to it
  // even after the agent rewrites the wording.
  type CustomQ = {
    id: string
    prompt: string
    type: 'text' | 'choice'
    options: string[]
    surface: 'signin' | 'success'
  }
  const questions: CustomQ[] = Array.isArray(profile?.custom_questions) ? profile.custom_questions : []
  const setQuestions = (qs: CustomQ[]) => setProfile({ ...profile, custom_questions: qs })
  const signinCount = questions.filter(q => q.surface === 'signin').length
  const successCount = questions.filter(q => q.surface === 'success').length
  const addQuestion = (surface: 'signin' | 'success') =>
    setQuestions([...questions, {
      id: (globalThis.crypto?.randomUUID?.() ?? `q-${Date.now()}-${questions.length}`),
      prompt: '', type: 'text', options: [], surface,
    }])
  const updateQuestion = (id: string, patch: Partial<CustomQ>) =>
    setQuestions(questions.map(q => (q.id === id ? { ...q, ...patch } : q)))
  const removeQuestion = (id: string) => setQuestions(questions.filter(q => q.id !== id))
  const setOption = (id: string, i: number, value: string) =>
    setQuestions(questions.map(q => {
      if (q.id !== id) return q
      const options = [...(q.options || [])]
      options[i] = value
      return { ...q, options }
    }))
  const addOption = (id: string) =>
    setQuestions(questions.map(q => (q.id === id ? { ...q, options: [...(q.options || []), ''] } : q)))
  const removeOption = (id: string, i: number) =>
    setQuestions(questions.map(q =>
      q.id === id ? { ...q, options: (q.options || []).filter((_, idx) => idx !== i) } : q
    ))

  const questionEditor = (q: CustomQ) => (
    <div key={q.id} style={{ border: '1px solid #d1d1d6', borderRadius: '12px', padding: '14px', marginBottom: '10px', background: '#fafafa' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 0, marginBottom: 0 }}
          type="text"
          maxLength={160}
          placeholder="Your question"
          value={q.prompt}
          onChange={e => updateQuestion(q.id, { prompt: e.target.value })}
        />
        <button
          onClick={() => removeQuestion(q.id)}
          aria-label="Remove this question"
          style={{ flexShrink: 0, padding: '9px 12px', background: 'white', color: '#6e6e73', border: '1px solid #d1d1d6', borderRadius: '9px', fontSize: '13px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          ✕
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: q.type === 'choice' ? '10px' : 0 }}>
        <span style={{ fontSize: '14px', color: '#6e6e73' }}>Answer:</span>
        {(['text', 'choice'] as const).map(kind => (
          <button
            key={kind}
            onClick={() => updateQuestion(q.id, {
              type: kind,
              // Seed two blank options so a fresh choice question is editable.
              options: kind === 'choice' && (q.options || []).length === 0 ? ['', ''] : q.options,
            })}
            style={{
              padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: q.type === kind ? 700 : 500,
              border: q.type === kind ? `2px solid ${primaryColor}` : '1px solid #d1d1d6',
              background: q.type === kind ? primaryColor : 'white',
              color: q.type === kind ? onPrimary : '#1d1d1f',
            }}
          >
            {kind === 'text' ? 'Typed answer' : 'Multiple choice'}
          </button>
        ))}
      </div>
      {q.type === 'choice' && (
        <>
          {(q.options || []).map((opt, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <input
                style={{ ...inputStyle, flex: 1, minWidth: 0, marginBottom: 0 }}
                type="text"
                maxLength={60}
                placeholder={`Choice ${i + 1}`}
                value={opt}
                onChange={e => setOption(q.id, i, e.target.value)}
              />
              <button
                onClick={() => removeOption(q.id, i)}
                aria-label="Remove this choice"
                style={{ flexShrink: 0, padding: '9px 12px', background: 'white', color: '#6e6e73', border: '1px solid #d1d1d6', borderRadius: '9px', fontSize: '13px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                ✕
              </button>
            </div>
          ))}
          {(q.options || []).length < 4 && (
            <button
              onClick={() => addOption(q.id)}
              style={{ padding: '7px 12px', background: 'white', color: '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '9px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              + Add a choice
            </button>
          )}
        </>
      )}
    </div>
  )

  return (
    <>
      <div style={{ fontSize: '24px', fontWeight: '600', color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>Account Settings</div>
      <div style={{ fontSize: '14px', color: '#6e6e73', marginBottom: '24px' }}>Manage your profile, branding, and preferences.</div>

      {/* Sponsored agents see their sponsor's card up top, where the plan
          card would sit. While the sponsor's billing is active it REPLACES
          the Subscription card (the account runs as full Pro — nothing to
          pay, nothing to pitch); the Subscription card still shows below it
          if the agent also carries their own paid plan (so they can manage
          or cancel their own billing), or if the sponsor's billing lapses
          (back to the normal plan options). */}
      {profile?.sponsor_id && (
        <SponsorshipSection
          profile={profile}
          setProfile={setProfile}
          agentId={agentId}
          showToast={showToast}
          sponsorCovered={sponsorCovered}
          onEnded={onSubscriptionChanged}
        />
      )}

      {isTeamMember ? (
        <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f', marginBottom: '8px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Subscription</div>
          {teamPaymentFailed ? (
            <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.5' }}>
              ⚠️ Your team&apos;s most recent payment didn&apos;t go through. Please contact your team/brokerage admin so your access isn&apos;t interrupted — there&apos;s nothing for you to pay directly.
            </div>
          ) : (
            <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: '1.5' }}>
              ✓ You&apos;re covered under your team&apos;s plan. Billing is managed by your team lead — there&apos;s nothing for you to pay.
            </div>
          )}
        </div>
      ) : (!sponsorCovered || ownPaidActive) ? (
        <SubscriptionSection
          profile={profile}
          agentId={agentId}
          supabase={supabase}
          showToast={showToast}
          onChanged={onSubscriptionChanged}
        />
      ) : null}

      <ReferralSection profile={profile} />

      {/* Two-column card grid on wide screens (Dave: too much scrolling).
          Subscription + Referral stay full-width above; auto-fit collapses
          back to one column under ~1000px, so phones are unchanged. Cards
          keep their own marginBottom for row spacing; columnGap handles the
          horizontal gutter. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', columnGap: '16px', alignItems: 'start' }}>

      <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Agent Profile</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input style={inputStyle} type="text" placeholder="Sarah Connelly" value={profile?.full_name || ''} onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Brokerage</label>
            {profile?.brokerage_id ? (
              <>
                <input style={{ ...inputStyle, background: '#ececf0', color: '#8e8e93', cursor: 'not-allowed' }} type="text" placeholder="Managed by your team" value={profile?.brokerage || ''} disabled readOnly />
                <div style={{ fontSize: '14px', color: '#6e6e73', marginTop: '4px' }}>
                  🔒 Managed by your team.{isTeamAdmin ? ' Set the team name in the Team tab.' : ''}
                </div>
              </>
            ) : (
              <input style={inputStyle} type="text" placeholder="Premier Realty Group" value={profile?.brokerage || ''} onChange={e => setProfile({ ...profile, brokerage: e.target.value })} />
            )}
          </div>
          <div>
            <label style={labelStyle}>Display Email (shown to visitors)</label>
            <input style={inputStyle} type="email" placeholder="sarah@premierre.com" value={profile?.display_email || ''} onChange={e => setProfile({ ...profile, display_email: e.target.value })} />
            <div style={{ fontSize: '12px', color: profile?.display_email?.trim() ? '#6e6e73' : '#b25e00', marginTop: '4px', lineHeight: '1.4' }}>
              {profile?.display_email?.trim()
                ? 'Where visitor replies and your copy of each sign-in are sent.'
                : '⚠ Recommended — set this so replies and your sign-in copies go here, keeping your private login email hidden from visitors.'}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} type="tel" placeholder="(214) 555-0182" value={profile?.phone || ''} onChange={e => setProfile({ ...profile, phone: formatPhone(e.target.value) })} />
          </div>
          <div>
            <label style={labelStyle}>License Number</label>
            <input style={inputStyle} type="text" placeholder="TX-123456" value={profile?.license_number || ''} onChange={e => setProfile({ ...profile, license_number: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>State</label>
            <input style={inputStyle} type="text" placeholder="TX" value={profile?.state || ''} onChange={e => setProfile({ ...profile, state: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Agent Landing Page URL</label>
            <input style={inputStyle} type="url" placeholder="https://yourwebsite.com/bio" value={profile?.landing_page_url || ''} onChange={e => setProfile({ ...profile, landing_page_url: e.target.value })} />
            <div style={{ fontSize: '14px', color: '#6e6e73', marginTop: '4px' }}>Your bio page, Instagram, or Linktree. Appears in visitor emails and texts.</div>
          </div>
          <div>
            <label style={labelStyle}>Agent Headshot URL</label>
            <input style={inputStyle} type="url" placeholder="https://yoursite.com/headshot.jpg" value={profile?.headshot_url || ''} onChange={e => setProfile({ ...profile, headshot_url: e.target.value })} />
            <div style={{ fontSize: '14px', color: '#6e6e73', marginTop: '4px' }}>Paste a direct image URL (.jpg or .png) — right-click your photo online and choose &ldquo;Copy Image Address&rdquo;, or upload it to <a href="https://imgur.com" target="_blank" style={{ color: '#0071e3' }}>imgur.com</a>.</div>
            {profile?.headshot_url && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={profile.headshot_url} alt="Headshot" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #d1d1d6' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                <span style={{ fontSize: '11px', color: '#30d158', fontWeight: '600' }}>✓ Preview loaded</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Branding (logo + colors). Hidden ENTIRELY for team/brokerage
          accounts (Dave's call): both are team-managed and locked there, so
          the card would be nothing but lock notes — admins manage branding
          in the Team tab, members ask their team lead. */}
      {!profile?.brokerage_id && (
      <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f', marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Branding</div>
        <div style={{ fontSize: '14px', color: '#6e6e73', marginBottom: '16px', lineHeight: '1.5' }}>
          Your logo and colors appear on the visitor sign-in form, in visitor emails, and on your printed sign.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Logo URL</label>
                <input style={inputStyle} type="url" placeholder="https://yoursite.com/logo.png" value={profile?.logo_url || ''} onChange={e => setProfile({ ...profile, logo_url: e.target.value })} />
                <div style={{ fontSize: '14px', color: '#6e6e73', marginTop: '4px' }}>A logo with a transparent or white background looks best in emails and on your printed sign.</div>
                {profile?.logo_url && (
                  <div style={{ marginTop: '8px', background: '#f5f5f7', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '52px', border: '1px solid #d1d1d6' }}>
                    <img
                      src={profile.logo_url}
                      alt="Logo preview"
                      style={{ maxHeight: '72px', maxWidth: '180px', objectFit: 'contain', display: 'block' }}
                      onLoad={e => { (e.target as HTMLImageElement).style.display = 'block' }}
                      onError={e => {
                        const el = e.target as HTMLImageElement
                        el.style.display = 'none'
                        const parent = el.parentElement
                        if (parent) parent.innerHTML = '<span style="font-size:11px;color:#cc0000;">⚠️ Image could not load — check URL</span>'
                      }}
                    />
                  </div>
                )}
          </div>
        </div>

        {/* Colors share the branding card — one card, less scrolling. */}
        <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #e5e5ea' }}>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f', marginBottom: '4px' }}>Brand Colors</div>
              <div style={{ fontSize: '14px', color: '#6e6e73', marginBottom: '12px' }}>Applied to your visitor registration form and email header.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Primary Color</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input type="color" value={profile?.primary_color || '#1d1d1f'} onChange={e => setProfile({ ...profile, primary_color: e.target.value })} style={{ width: '48px', height: '38px', border: '1px solid #d1d1d6', borderRadius: '8px', cursor: 'pointer', padding: '2px' }} />
                    <input style={{ ...inputStyle, flex: 1 }} type="text" placeholder="#1d1d1f" value={profile?.primary_color || '#1d1d1f'} onChange={e => setProfile({ ...profile, primary_color: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Accent Color</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input type="color" value={profile?.accent_color || '#0071e3'} onChange={e => setProfile({ ...profile, accent_color: e.target.value })} style={{ width: '48px', height: '38px', border: '1px solid #d1d1d6', borderRadius: '8px', cursor: 'pointer', padding: '2px' }} />
                    <input style={{ ...inputStyle, flex: 1 }} type="text" placeholder="#0071e3" value={profile?.accent_color || '#0071e3'} onChange={e => setProfile({ ...profile, accent_color: e.target.value })} />
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '14px', padding: '12px 16px', background: '#f5f5f7', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '14px', color: '#6e6e73' }}>Preview:</div>
                <div style={{ background: primaryColor, color: onPrimary, border: fillBorder(primaryColor), padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>oh<strong>ACCESS</strong></div>
                <div style={{ background: accentColor, color: onAccent, border: accentBtnBorder, padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>Button</div>
              </div>
        </div>
      </div>
      )}

      <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f', marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Send Leads to Your CRM</div>
        <div style={{ fontSize: '14px', color: '#6e6e73', margin: '12px 0 14px', lineHeight: '1.6' }}>
          Every new visitor flows straight into your CRM as a lead — no Zapier, no setup fees. Your CRM gives each user a unique &quot;lead intake&quot; email address; paste it here and we send each sign-in there automatically. Works with Follow Up Boss, BoldTrail/kvCORE, Lofty, Sierra Interactive, Real Geeks, and most others.
        </div>
        <label style={labelStyle}>Your CRM</label>
        <select style={inputStyle} value={profile?.crm_type || ''} onChange={e => setProfile({ ...profile, crm_type: e.target.value })}>
          <option value="">Select your CRM (optional)</option>
          <option value="follow_up_boss">Follow Up Boss</option>
          <option value="boldtrail">BoldTrail / kvCORE</option>
          <option value="lofty">Lofty (formerly Chime)</option>
          <option value="sierra_interactive">Sierra Interactive</option>
          <option value="real_geeks">Real Geeks</option>
          <option value="cinc">CINC</option>
          <option value="top_producer">Top Producer</option>
          <option value="wise_agent">Wise Agent</option>
          <option value="liondesk">LionDesk</option>
          <option value="other">Other</option>
        </select>
        <label style={{ ...labelStyle, marginTop: '12px' }}>Your CRM lead-intake email</label>
        <input style={inputStyle} type="email" placeholder="e.g. yourname@followupboss.me" value={profile?.crm_lead_email || ''} onChange={e => setProfile({ ...profile, crm_lead_email: e.target.value })} />
        <div style={{ marginTop: '12px', background: '#f5f5f7', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: '#6e6e73', lineHeight: '1.7' }}>
          <strong style={{ color: '#1d1d1f' }}>Where to find your lead-intake email:</strong><br />
          • <strong>Follow Up Boss</strong> — your <em>@followupboss.me</em> address (Admin → Overview → API Keys &amp; Lead Email, under Integrations).<br />
          • <strong>BoldTrail / kvCORE</strong> — Lead Engine → your lead parsing email.<br />
          • <strong>Lofty, Sierra, Real Geeks, CINC, Top Producer, Wise Agent</strong> — search your CRM&apos;s help for &quot;lead parsing&quot; or &quot;forward leads by email&quot; to get your unique address.<br />
          Paste it above and click Save settings. New sign-ins appear in your CRM within seconds. (Tip: add <em>noreply@mail.ohaccess.com</em> as an allowed sender in your CRM so leads aren&apos;t filtered.)
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f', marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Advanced: CRM Integration via Zapier</div>
        <div style={{ fontSize: '14px', color: '#6e6e73', margin: '12px 0 14px', lineHeight: '1.6' }}>
          Send every new visitor straight into your CRM — Follow Up Boss, kvCORE, a Google Sheet, and 7,000+ apps — through Zapier.
        </div>
        <label style={labelStyle}>Zapier webhook URL</label>
        <input style={inputStyle} type="url" placeholder="https://hooks.zapier.com/hooks/catch/..." value={profile?.zapier_webhook_url || ''} onChange={e => setProfile({ ...profile, zapier_webhook_url: e.target.value })} />
        <div style={{ marginTop: '12px', background: '#f5f5f7', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: '#6e6e73', lineHeight: '1.7' }}>
          <strong style={{ color: '#1d1d1f' }}>Set it up in ~5 minutes:</strong><br />
          1. In Zapier, create a Zap with the trigger <strong>&quot;Webhooks by Zapier → Catch Hook.&quot;</strong><br />
          2. Copy the custom webhook URL Zapier gives you, paste it above, and click Save settings.<br />
          3. In Zapier, add your CRM as the action (e.g. <strong>Follow Up Boss → Create Lead</strong>) and map the fields we send: first/last name, email, phone, timeline, property address, and a link to the visitor.<br />
          4. Turn the Zap on — new visitors now flow into your CRM automatically.
          <div style={{ marginTop: '8px', fontStyle: 'italic' }}>Note: Zapier&apos;s &quot;Catch Hook&quot; trigger requires a paid Zapier plan.</div>
        </div>
      </div>

      {/* Custom questions — one extra on the sign-in form (the entry gate, so
          strictly capped) and up to two after the tour. The built-in rating and
          price questions are fixed and not editable here: the seller report
          aggregates them by name. */}
      <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f', marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Your Own Questions</div>
        <div style={{ fontSize: '14px', color: '#6e6e73', margin: '12px 0 14px', lineHeight: '1.6' }}>
          Ask visitors something of your own, on top of the standard fields. Every custom question is optional for the visitor — nothing you add here can stop someone from getting their codeword.
        </div>

        <label style={labelStyle}>On the sign-in form &mdash; 1 question</label>
        <div style={{ fontSize: '14px', color: '#6e6e73', margin: '2px 0 10px', lineHeight: '1.6' }}>
          Asked before they get their codeword, so keep it short.
        </div>
        {questions.filter(q => q.surface === 'signin').map(questionEditor)}
        {signinCount < 1 && (
          <button
            onClick={() => addQuestion('signin')}
            style={{ padding: '8px 14px', background: 'white', color: '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            + Add a sign-in question
          </button>
        )}

        <label style={{ ...labelStyle, marginTop: '20px' }}>After the tour &mdash; up to 2 questions</label>
        <div style={{ fontSize: '14px', color: '#6e6e73', margin: '2px 0 10px', lineHeight: '1.6' }}>
          Asked on the confirmation screen, alongside the standard rating and price questions.
        </div>
        {questions.filter(q => q.surface === 'success').map(questionEditor)}
        {successCount < 2 && (
          <button
            onClick={() => addQuestion('success')}
            style={{ padding: '8px 14px', background: 'white', color: '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            + Add a post-tour question
          </button>
        )}

        <div style={{ marginTop: '14px', background: '#f5f5f7', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: '#6e6e73', lineHeight: '1.7' }}>
          Answers show up on each visitor&apos;s record, in your CSV export, and in the lead sent to your CRM.<br /><br />
          <strong style={{ color: '#1d1d1f' }}>Two things worth knowing:</strong> your questions appear in the language you write them, even for a visitor who switches the form to Spanish or another language. And editing or deleting a question later never changes answers you&apos;ve already collected — those keep the wording they were asked under.
        </div>
      </div>

      {/* Disclosures & notices — agent-supplied label + link, delivered to the
          visitor on the success screen and in their code-word email. ohACCESS
          never picks the form, hosts it, or collects a signature. */}
      <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f', marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Disclosures &amp; Notices</div>
        <div style={{ fontSize: '14px', color: '#6e6e73', margin: '12px 0 14px', lineHeight: '1.6' }}>
          Add a link to any disclosure or notice you want every visitor to receive — an agency disclosure, an Information About Brokerage Services form, a Consumer Information Statement. Each one appears on the visitor&apos;s confirmation screen and in their codeword email.
        </div>
        {disclosureRows.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
            <input
              style={{ ...inputStyle, flex: '1 1 38%', minWidth: 0 }}
              type="text"
              maxLength={80}
              placeholder="Name shown to visitors"
              value={row.label}
              onChange={e => updateDisclosureRow(i, { ...row, label: e.target.value })}
            />
            <input
              style={{ ...inputStyle, flex: '1 1 62%', minWidth: 0 }}
              type="url"
              placeholder="https://..."
              value={row.url}
              onChange={e => updateDisclosureRow(i, { ...row, url: e.target.value })}
            />
            <button
              onClick={() => removeDisclosureRow(i)}
              aria-label="Remove this disclosure"
              style={{ flexShrink: 0, padding: '9px 12px', background: 'white', color: '#6e6e73', border: '1px solid #d1d1d6', borderRadius: '9px', fontSize: '13px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              ✕
            </button>
          </div>
        ))}
        {disclosureRows.length < 5 && (
          <button
            onClick={addDisclosureRow}
            style={{ marginTop: '4px', padding: '8px 14px', background: 'white', color: '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            + Add a disclosure
          </button>
        )}
        <div style={{ marginTop: '12px', background: '#f5f5f7', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: '#6e6e73', lineHeight: '1.7' }}>
          These are documents <strong style={{ color: '#1d1d1f' }}>you</strong> supply. ohACCESS delivers them and records that they were sent — we don&apos;t determine what your state or broker requires. Links must start with <em>https://</em> and should point somewhere permanent (your brokerage&apos;s site or your state commission&apos;s form page), since visitors may open them later.
          {isTeamMember && (
            <><br /><br /><strong style={{ color: '#1d1d1f' }}>Note:</strong> if your brokerage has set its own disclosures, those are sent instead of yours.</>
          )}
        </div>
      </div>

      {/* Agreements signed before entry — the agent's uploaded blank forms
          (touring agreement, buyer-rep one-pager, disclosure). Turned on per
          open house in the New Open House form. Signed copies are emailed to
          both parties and never stored; only the blank template lives here. */}
      <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f', marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Agreements Signed Before Entry</div>
        <div style={{ fontSize: '14px', color: '#6e6e73', margin: '12px 0 14px', lineHeight: '1.6' }}>
          For open houses that need a <strong style={{ color: '#1d1d1f' }}>signature</strong> before the tour — a touring agreement when you host another brokerage&apos;s listing, a buyer-rep one-pager, anything your broker requires signed rather than just delivered. Upload the blank PDF once here, then flip on &ldquo;Require a signed agreement&rdquo; when you set up an open house. Visitors e-sign on their phone right after check-in; the signed PDF is emailed to you and to them, and <strong style={{ color: '#1d1d1f' }}>ohACCESS never stores signed documents</strong>.
        </div>

        {agreementTemplates.map(tpl => (
          <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #d1d1d6', borderRadius: '12px', padding: '10px 14px', marginBottom: '8px', background: '#fafafa' }}>
            <span style={{ fontSize: '18px' }}>📄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.label}</div>
              <div style={{ fontSize: '11px', color: '#6e6e73' }}>
                {tpl.pages} page{tpl.pages === 1 ? '' : 's'}{tpl.size > 0 ? ` · ${Math.max(1, Math.round(tpl.size / 1024))} KB` : ''}{tpl.uploaded_at ? ` · uploaded ${new Date(tpl.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
              </div>
            </div>
            <button
              onClick={() => deleteAgreementTemplate(tpl.id)}
              disabled={agreementBusy}
              aria-label="Delete this document"
              style={{ flexShrink: 0, padding: '9px 12px', background: 'white', color: '#6e6e73', border: '1px solid #d1d1d6', borderRadius: '9px', fontSize: '13px', cursor: agreementBusy ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              ✕
            </button>
          </div>
        ))}

        {agreementTemplates.length < MAX_AGREEMENT_TEMPLATES && (
          <div style={{ border: '1px dashed #d1d1d6', borderRadius: '12px', padding: '14px', marginTop: agreementTemplates.length > 0 ? '4px' : 0 }}>
            <label style={labelStyle}>Name shown to visitors</label>
            <input
              style={inputStyle}
              type="text"
              maxLength={80}
              placeholder="e.g. Touring Agreement"
              value={agreementLabel}
              onChange={e => setAgreementLabel(e.target.value)}
            />
            <label style={{ ...labelStyle, marginTop: '10px' }}>PDF file (up to 5 pages, 2 MB)</label>
            {/* The native file input is nearly invisible (Dave's feedback), so
                it hides inside a styled label that reads as a real button; the
                chosen filename echoes beside it as confirmation. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 14px', background: 'white', color: '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                📎 Choose PDF…
                <input
                  key={agreementFileKey}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={e => setAgreementFile(e.target.files?.[0] || null)}
                  style={{ display: 'none' }}
                />
              </label>
              <span style={{ fontSize: '12px', color: agreementFile ? '#1a7a3c' : '#6e6e73', fontWeight: agreementFile ? '600' : '400' }}>
                {agreementFile ? `✓ ${agreementFile.name}` : 'No file chosen yet'}
              </span>
            </div>
            <button
              onClick={uploadAgreementTemplate}
              disabled={agreementBusy}
              style={{ padding: '8px 14px', background: primaryColor, color: onPrimary, border: primaryBtnBorder, borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: agreementBusy ? 'not-allowed' : 'pointer', opacity: agreementBusy ? 0.6 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {agreementBusy ? 'Uploading…' : '⬆ Upload document'}
            </button>
          </div>
        )}

        <div style={{ marginTop: '12px', background: '#f5f5f7', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: '#6e6e73', lineHeight: '1.7' }}>
          These are documents <strong style={{ color: '#1d1d1f' }}>you</strong> supply — your brokerage form, your state association&apos;s touring agreement, or one your broker approves. ohACCESS collects the signature and delivers the copies; we don&apos;t determine what your situation requires or provide legal forms. Uploads save immediately (no need to hit Save settings). Deleting a document here simply removes the signing step from any open house that was using it — past signed copies live in email, untouched.
        </div>
      </div>

      </div>{/* end two-column card grid */}

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
        <button onClick={saveSettings} style={{ padding: '9px 18px', background: primaryColor, color: onPrimary, border: primaryBtnBorder, borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          ✓ Save settings
        </button>
      </div>
    </>
  )
}
