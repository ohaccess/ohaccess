'use client'
import { useState, useEffect } from 'react'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import TeamAdminPanel from './_components/TeamAdminPanel'
import TeamActivityPanel from './_components/TeamActivityPanel'
import QrModal from './_components/QrModal'
import InviteModal from './_components/InviteModal'
import OpenHouseList from './_components/OpenHouseList'
import NewOpenHouseForm from './_components/NewOpenHouseForm'
import SettingsPanel from './_components/SettingsPanel'
import VisitorDetail from '@/app/_components/VisitorDetail'
import { isLightColor, onColor, readableOnLight, fillBorder } from '@/lib/colors'
import { isExpiredPrepaidAccess, trialLimitFor } from '@/lib/billing-plans'
import { normalizeCustomAnswers } from '@/lib/custom-questions'
import { sanitizeSmsCodeWord } from '@/lib/register-helpers'
import { normalizeAgreementTemplates } from '@/lib/agreements'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [openHouses, setOpenHouses] = useState<any[]>([])
  const [visitors, setVisitors] = useState<any[]>([])
  const [selectedOH, setSelectedOH] = useState<any>(null)
  const [view, setView] = useState<'dashboard' | 'new' | 'settings' | 'team' | 'activity'>('dashboard')
  const [loading, setLoading] = useState(true)
  const [showCal, setShowCal] = useState(false)
  const [calDate, setCalDate] = useState(new Date())
  const [editingOH, setEditingOH] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [savedSettings, setSavedSettings] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [qrModal, setQrModal] = useState<any>(null)
  const [inviteModal, setInviteModal] = useState<any>(null)
  const [visitorModal, setVisitorModal] = useState<any>(null)
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [form, setForm] = useState({
    street_address: '',
    address_2: '',
    city: '',
    state: '',
    zip_code: '',
    listing_price: '',
    bedrooms: '',
    bathrooms: '',
    square_footage: '',
    open_house_date: '',
    open_house_date_iso: '',
    open_house_start_time: '',
    open_house_end_time: '',
    open_house_hours: '',
    property_timezone: '',
    listing_url: '',
    code_word: '',
    code_word_email: '',
    // Touring agreement (migration 043): whether visitors must sign before
    // entry, and WHICH of the agent's uploaded documents apply (max 3).
    require_agreement: false,
    agreement_template_ids: [] as string[]
  })
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)
  const [totalVisitors, setTotalVisitors] = useState<number | null>(null)
  const [teamStatus, setTeamStatus] = useState<{ subscription_status: string | null } | null>(null)
  // Covered by a PAYING sponsor (billing_status 'active') — Pro-level access,
  // like membership on a paying team. Display/branding sponsorship alone
  // (unpaid sponsor) doesn't unlock anything.
  const [sponsorCovered, setSponsorCovered] = useState(false)

  const primaryColor = profile?.primary_color || '#1d1d1f'
  const accentColor = profile?.accent_color || '#0071e3'

  // Keep the topbar readable whatever primary the agent picks: a
  // near-white primary needs dark text instead of white.
  const primaryIsLight = isLightColor(primaryColor)
  const onPrimary = onColor(primaryColor)
  // Subtle pill behind the active nav item — a muted shade of the
  // primary (darken it when light, lighten it when dark).
  const navActiveBg = primaryIsLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.18)'
  const onPrimaryBorder = primaryIsLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'
  // Primary-filled buttons get the same treatment as accent ones.
  const primaryBtnBorder = fillBorder(primaryColor)
  // Same idea for the accent: dark label on light-filled buttons, a
  // hairline edge so a near-white button still shows on the page, and a
  // readable fallback when the accent is used as text/links/borders.
  const onAccent = onColor(accentColor)
  const accentBtnBorder = fillBorder(accentColor)
  const accentText = readableOnLight(accentColor)

  // Team-admin (team-lead) gets a Team tab; everyone else sees the standard nav.
  const isTeamAdmin = profile?.role === 'brokerage_admin'
  // A non-admin agent who belongs to a team doesn't manage billing — the team
  // lead does — so they don't see the Subscription section. If they're later
  // removed (brokerage_id cleared), it reappears.
  const isTeamMember = !!profile?.brokerage_id && profile?.role !== 'brokerage_admin'

  // A LEGACY 2-year prepay or an admin comp (gifted access) — both paid tier
  // with no Stripe subscription — still reads tier=paid after it lapses. Treat
  // a past access date as expired so the agent gets the renewal prompt (and
  // the trial cap) like any free agent. Real subscriptions auto-renew.
  const prepaidExpired = isExpiredPrepaidAccess(profile)

  // A team member's access depends on the TEAM's billing health, not their own
  // row. If the team payment failed (past_due), warn them but keep access; if
  // the team fully lapsed the webhook already unlinked them to free.
  const teamPaymentFailed = isTeamMember && teamStatus?.subscription_status === 'past_due'

  // Free-tier agents who've used all their trial registrations (25 plus any
  // admin-gifted bonus) are locked out of every action until they upgrade.
  // This also catches agents who were removed from a team (they drop to free)
  // and are already over the cap.
  const trialLimit = trialLimitFor(profile)
  const isPaidTier =
    (['pro', 'team', 'brokerage'].includes(profile?.tier || 'free') && !prepaidExpired) ||
    sponsorCovered
  const locked = !isPaidTier && (totalVisitors ?? 0) >= trialLimit
  const guardLocked = (): boolean => {
    if (locked) {
      showToast(`You’ve used all ${trialLimit} free registrations. Upgrade to keep using ohACCESS.`, 'error')
      return true
    }
    return false
  }
  const navViews: Array<'dashboard' | 'new' | 'team' | 'activity' | 'settings'> = isTeamAdmin
    ? ['dashboard', 'new', 'team', 'activity', 'settings']
    : ['dashboard', 'new', 'settings']
  const navLabel = (v: string) =>
    v === 'dashboard' ? 'Dashboard' : v === 'new' ? 'New Open House' : v === 'team' ? 'Team' : v === 'activity' ? 'Brokerage' : 'Settings'
  const navLabelMobile = (v: string) =>
    v === 'dashboard' ? '📊 Dashboard' : v === 'new' ? '＋ New Open House' : v === 'team' ? '👥 Team' : v === 'activity' ? '🏢 Brokerage' : '⚙️ Settings'


  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => { checkUser() }, [])

  // Honor ?view= and ?checkout= params from Stripe redirects and pricing CTAs.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const v = params.get('view')
    if (v === 'settings' || v === 'new' || v === 'dashboard' || v === 'team' || v === 'activity') setView(v)
    const checkout = params.get('checkout')
    if (checkout === 'success') {
      showToast('Subscription activated — welcome aboard!')
    } else if (checkout === 'cancel') {
      showToast('Checkout canceled. You can upgrade anytime from settings.', 'error')
    }
    if (v || checkout) {
      // Clean the URL so refresh doesn't re-fire the toast.
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const { data: refreshData } = await supabase.auth.refreshSession()
      if (!refreshData.session) { window.location.href = '/login'; return }
      if (await isSponsorAccount(refreshData.session.user.id)) { window.location.href = '/sponsor/dashboard'; return }
      setUser(refreshData.session.user)
      await loadProfile(refreshData.session.user.id)
      await loadOpenHouses(refreshData.session.user.id)
      await loadVisitorCount(refreshData.session.user.id)
      await loadTeamStatus()
      setLoading(false)
      return
    }
    if (await isSponsorAccount(session.user.id)) { window.location.href = '/sponsor/dashboard'; return }
    setUser(session.user)
    await loadProfile(session.user.id)
    await loadOpenHouses(session.user.id)
    await loadVisitorCount(session.user.id)
    await loadTeamStatus()
    setLoading(false)
  }

  // Sponsor accounts (lenders etc.) share /login but have their own dashboard.
  // RLS lets a user read only their own sponsors row, so this is cheap and safe.
  const isSponsorAccount = async (userId: string) => {
    const { data } = await supabase.from('sponsors').select('id').eq('owner_id', userId).maybeSingle()
    return !!data
  }

  // Team billing health (drives the "contact your admin" banner for members).
  // Returns { hasTeam:false } for solo agents — including ex-members the webhook
  // unlinked when their team lapsed, who then see the normal plan options.
  const loadTeamStatus = async () => {
    try {
      const res = await fetch('/api/team/status', { headers: await authHeaders() })
      if (!res.ok) { setTeamStatus(null); return }
      const json = await res.json()
      setTeamStatus(json.hasTeam ? { subscription_status: json.subscription_status } : null)
    } catch {
      setTeamStatus(null)
    }
  }

  const loadVisitorCount = async (userId: string) => {
    const { count } = await supabase
      .from('visitors')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', userId)
    setTotalVisitors(count ?? 0)
  }

  const loadProfile = async (userId: string) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (data) {
        setProfile(data)
        // Paying sponsor coverage (RLS lets a sponsored agent read their own
        // sponsor's row). Best-effort: a lookup failure just means no unlock.
        if (data.sponsor_id) {
          const { data: sp } = await supabase
            .from('sponsors')
            .select('billing_status')
            .eq('id', data.sponsor_id)
            .maybeSingle()
          setSponsorCovered(sp?.billing_status === 'active')
        } else {
          setSponsorCovered(false)
        }
      } else {
        // Auto-create profile if it doesn't exist. Pull the referral source
        // from auth user_metadata first (set at signup, survives email
        // confirmation across browsers); fall back to the cookie for OAuth
        // or same-session flows.
        const { data: userData } = await supabase.auth.getUser()
        const metaRef =
          (userData.user?.user_metadata?.referral_source as string | undefined) ||
          null
        const refCookie = document.cookie
          .split('; ')
          .find((c) => c.startsWith('ohaccess_ref='))
        const cookieRef = refCookie
          ? decodeURIComponent(refCookie.split('=')[1] || '')
          : null
        const referralSource = metaRef || cookieRef

        const insertRow: Record<string, unknown> = {
          id: userId,
          email: userData.user?.email,
        }
        if (referralSource) {
          insertRow.referral_source = referralSource
          insertRow.referral_source_first_seen_at = new Date().toISOString()
        }

        const { data: newProfile } = await supabase
          .from('profiles')
          .insert(insertRow)
          .select()
          .single()
        if (newProfile) setProfile(newProfile)
      }

      // One-time heads-up to the ohACCESS team that a new account is active.
      // The endpoint claims a per-account flag server-side, so it emails at
      // most once per account no matter how often this runs; the sessionStorage
      // guard just avoids redundant calls within a browser session.
      try {
        if (!sessionStorage.getItem('ohaccess_signup_notified')) {
          sessionStorage.setItem('ohaccess_signup_notified', '1')
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            void fetch('/api/notify/new-account', {
              method: 'POST',
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
          }
        }
      } catch {
        // best-effort; never block the dashboard on a notification
      }
    }

  const loadOpenHouses = async (userId: string) => {
    const { data } = await supabase.from('open_houses').select('*').eq('agent_id', userId).order('created_at', { ascending: false })
    if (data) {
      setOpenHouses(data)
      if (data.length > 0) { setSelectedOH(data[0]); await loadVisitors(data[0].id) }
    }
  }

  const loadVisitors = async (openHouseId: string) => {
    const { data } = await supabase.from('visitors').select('*').eq('open_house_id', openHouseId).order('registered_at', { ascending: false })
    if (!data) return
    // Signed-agreement receipts for the chip in the visitor log (RLS lets an
    // agent read only their own receipts). Best-effort: a lookup failure just
    // means no chips, never a broken log.
    let signedIds = new Set<string>()
    try {
      const { data: receipts } = await supabase
        .from('agreement_receipts')
        .select('visitor_id')
        .eq('open_house_id', openHouseId)
      signedIds = new Set((receipts || []).map(r => r.visitor_id))
    } catch { /* no chips */ }
    setVisitors(data.map(v => ({ ...v, agreement_signed: signedIds.has(v.id) })))
  }

  // The SMS (text) code is an adjective; the email code is a home-themed noun.
  // Two distinct words let the host ask specifically for the harder-to-spoof
  // TEXT code at the door.
  const SMS_WORDS = ['BESPOKE','CHARMING','CLASSIC','COZY','ELEGANT','GRAND','HISTORIC','INVITING','LOVELY','LUXE','MODERN','POLISHED','PRISTINE','RADIANT','REFINED','SERENE','SPACIOUS','STATELY','STUNNING','STYLISH','TIMELESS','TRANQUIL','WELCOMING']
  const EMAIL_WORDS = ['BOULEVARD','BUNGALOW','CONDOMINIUM','COTTAGE','COURTYARD','ELEVATION','ESTATE','GARDEN','HAVEN','HIGHRISE','LOFT','MANOR','MANSION','PENTHOUSE','RESIDENCE','SANCTUARY','TERRACE','TOWNHOUSE','TUDOR','VERANDA','VILLA','VILLAGE']
  const generateSmsWord = () => SMS_WORDS[Math.floor(Math.random() * SMS_WORDS.length)]
  const generateEmailWord = () => EMAIL_WORDS[Math.floor(Math.random() * EMAIL_WORDS.length)]

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').substring(0, 10)
    if (digits.length === 0) return ''
    if (digits.length <= 3) return `(${digits}`
    if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  }

  const resetForm = () => setForm({
    street_address: '', address_2: '', city: '', state: '', zip_code: '',
    listing_price: '', bedrooms: '', bathrooms: '',
    square_footage: '', open_house_date: '', open_house_date_iso: '',
    open_house_start_time: '', open_house_end_time: '',
    open_house_hours: '', property_timezone: '', listing_url: '', code_word: '', code_word_email: '',
    require_agreement: false, agreement_template_ids: [] as string[]
  })

  // 24h "13:30" -> "1:30 PM" for the human-readable hours string.
  const fmtTime12 = (t: string) => {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }
  // How many minutes `tz` is ahead of UTC at `date` (handles DST).
  const tzOffsetMinutes = (tz: string, date: Date): number => {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    const parts: Record<string, string> = {}
    for (const p of dtf.formatToParts(date)) parts[p.type] = p.value
    const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
    return (asUTC - date.getTime()) / 60000
  }
  // Wall-clock date (yyyy-mm-dd) + time (HH:MM) -> UTC instant, interpreted in
  // `tz` (the property's timezone). Falls back to the device timezone if no tz.
  const wallToISO = (dateIso: string, time: string, tz?: string): string | null => {
    if (!dateIso || !time) return null
    if (!tz) {
      const d = new Date(`${dateIso}T${time}`)
      return isNaN(d.getTime()) ? null : d.toISOString()
    }
    const naive = new Date(`${dateIso}T${time}:00Z`).getTime()
    if (isNaN(naive)) return null
    const offset = tzOffsetMinutes(tz, new Date(naive))
    return new Date(naive - offset * 60000).toISOString()
  }
  // Stored UTC instant -> wall-clock yyyy-mm-dd + HH:MM in `tz` (for edit).
  const isoToLocalParts = (iso: string | null | undefined, tz?: string) => {
    if (!iso) return { date: '', time: '' }
    const d = new Date(iso)
    if (isNaN(d.getTime())) return { date: '', time: '' }
    const p = (n: number) => String(n).padStart(2, '0')
    if (!tz) {
      return {
        date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
        time: `${p(d.getHours())}:${p(d.getMinutes())}`,
      }
    }
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
    const parts: Record<string, string> = {}
    for (const part of dtf.formatToParts(d)) parts[part.type] = part.value
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
  }

  const authHeaders = async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  // Fetch (creating on first use) the agent's permanent QR link and open the
  // same QR modal used for per-open-house codes. The link never changes; the
  // /r redirect resolves it to the next/latest open house at scan time.
  const openPermanentQr = async () => {
    try {
      const res = await fetch('/api/agent-qr', { headers: await authHeaders() })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error || 'Could not load your permanent QR code.', 'error')
        return
      }
      const qrRes = await fetch(`/api/qrcode?url=${encodeURIComponent(json.shortUrl)}`)
      const blob = await qrRes.blob()
      const dataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
      setQrModal({
        oh: {
          property_address: 'My Permanent QR Code',
          open_house_date: 'Always points to your next open house',
          open_house_hours: ''
        },
        url: json.shortUrl,
        dataUrl,
        blob
      })
    } catch {
      showToast('Could not load your permanent QR code.', 'error')
    }
  }

  // Fetch (creating on first use) the shareable seller-report link for an
  // open house, copy it, and open a preview tab so the agent sees what the
  // seller will see. The report shows counts and timelines only — no visitor
  // contact info — so sharing it can't leak the lead list.
  const openSellerReport = async (ohId: string) => {
    try {
      const res = await fetch(`/api/open-house/${ohId}/report-link`, { headers: await authHeaders() })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error || 'Could not load the seller report link.', 'error')
        return
      }
      try { await navigator.clipboard.writeText(json.url) } catch {}
      window.open(json.url, '_blank', 'noopener')
      showToast('Report link copied — text or email it to your seller!')
    } catch {
      showToast('Could not load the seller report link.', 'error')
    }
  }

  const getAddressSuggestions = async (value: string) => {
    if (value.length < 3) { setShowSuggestions(false); return }
    try {
      const res = await fetch(`/api/places?input=${encodeURIComponent(value)}`, {
        headers: await authHeaders()
      })
      const data = await res.json()
      if (data.predictions && data.predictions.length > 0) {
        setAddressSuggestions(data.predictions)
        setShowSuggestions(true)
      } else {
        setShowSuggestions(false)
      }
    } catch {
      setShowSuggestions(false)
    }
  }

  const selectAddress = async (placeId: string) => {
    try {
      const res = await fetch(`/api/places?placeId=${placeId}`, {
        headers: await authHeaders()
      })
      const data = await res.json()
      if (data.street) {
        setForm(prev => ({
          ...prev,
          street_address: data.street,
          city: data.city,
          state: data.state,
          zip_code: data.zip,
          property_timezone: data.timezone || ''
        }))
      }
      setShowSuggestions(false)
      setAddressSuggestions([])
    } catch {
      setShowSuggestions(false)
    }
  }

  const createOpenHouse = async () => {
    if (guardLocked()) return
    if (!form.street_address || !form.city || !form.state || !form.code_word || !form.code_word_email) {
      showToast('Please fill in the address, city, state, and both codewords (text + email).')
      return
    }
    // Re-clean the text code on save, not just on keystroke — a paste, an
    // autofill, or an edit of a legacy open house can all get a value into
    // state that never passed through the input's onChange.
    const smsCode = sanitizeSmsCodeWord(form.code_word)
    if (!smsCode) {
      showToast('The text codeword needs at least one letter or number.')
      return
    }
    if (!form.open_house_date_iso || !form.open_house_start_time || !form.open_house_end_time) {
      showToast('Please choose the open house date, start time, and end time.')
      return
    }
    const tz = form.property_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    const startAt = wallToISO(form.open_house_date_iso, form.open_house_start_time, tz)
    const endAt = wallToISO(form.open_house_date_iso, form.open_house_end_time, tz)
    if (!startAt || !endAt || endAt <= startAt) {
      showToast('The end time needs to be after the start time.')
      return
    }
    const hoursText = `${fmtTime12(form.open_house_start_time)} – ${fmtTime12(form.open_house_end_time)}`
    const fullAddress = `${form.street_address}${form.address_2 ? ' ' + form.address_2 : ''}, ${form.city}, ${form.state}${form.zip_code ? ' ' + form.zip_code : ''}`
    const { data, error } = await supabase.from('open_houses').insert({
      agent_id: user.id,
      property_address: fullAddress,
      street_address: form.street_address,
      address_2: form.address_2,
      city: form.city,
      state: form.state,
      zip_code: form.zip_code,
      listing_price: form.listing_price,
      bedrooms: form.bedrooms,
      bathrooms: form.bathrooms,
      square_footage: form.square_footage,
      open_house_date: form.open_house_date,
      open_house_hours: hoursText,
      start_at: startAt,
      end_at: endAt,
      timezone: tz,
      listing_url: form.listing_url,
      code_word: smsCode,
      code_word_email: form.code_word_email,
      require_agreement: form.require_agreement,
      agreement_template_ids: form.agreement_template_ids.length > 0 ? form.agreement_template_ids : null,
      status: 'active'
    }).select()
    if (error) { showToast('Error saving: ' + error.message); return }
    if (data) {
      await loadOpenHouses(user.id)
      setView('dashboard')
      resetForm()
      if (data[0]) maybePromptInvites(data[0])
    }
  }

  // After publishing, offer to invite past visitors — but only when there's
  // actually someone eligible (a "0 matches" popup after every publish would
  // just be noise). Best effort: any failure silently skips the prompt; the
  // 💌 Invite button on the card is always there as the manual path.
  const maybePromptInvites = async (oh: any) => {
    try {
      const res = await fetch(`/api/open-house/${oh.id}/invites`, { headers: await authHeaders() })
      if (!res.ok) return
      const json = await res.json()
      if (json.canSend && json.matches?.length > 0) setInviteModal(oh)
    } catch { /* skip the prompt */ }
  }

  const startEdit = (oh: any) => {
    if (guardLocked()) return
    setEditingOH(oh)
    const start = isoToLocalParts(oh.start_at, oh.timezone)
    const end = isoToLocalParts(oh.end_at, oh.timezone)
    setForm({
      street_address: oh.street_address || '',
      address_2: oh.address_2 || '',
      city: oh.city || '',
      state: oh.state || '',
      zip_code: oh.zip_code || '',
      listing_price: oh.listing_price || '',
      bedrooms: oh.bedrooms || '',
      bathrooms: oh.bathrooms || '',
      square_footage: oh.square_footage || '',
      open_house_date: oh.open_house_date || '',
      open_house_date_iso: start.date,
      open_house_start_time: start.time,
      open_house_end_time: end.time,
      open_house_hours: oh.open_house_hours || '',
      property_timezone: oh.timezone || '',
      listing_url: oh.listing_url || '',
      // Clean on load too, so an older open house whose text code predates the
      // limit shows the agent exactly what will be saved rather than silently
      // changing under them when they hit Update.
      code_word: sanitizeSmsCodeWord(oh.code_word),
      code_word_email: oh.code_word_email || '',
      require_agreement: !!oh.require_agreement,
      agreement_template_ids: Array.isArray(oh.agreement_template_ids)
        ? oh.agreement_template_ids.filter((x: unknown) => typeof x === 'string')
        : []
    })
    setView('new')
  }

  const updateOpenHouse = async () => {
    if (guardLocked()) return
    if (!form.street_address || !form.city || !form.state || !form.code_word || !form.code_word_email) {
      showToast('Please fill in the address, city, state, and both codewords (text + email).')
      return
    }
    const smsCode = sanitizeSmsCodeWord(form.code_word)
    if (!smsCode) {
      showToast('The text codeword needs at least one letter or number.')
      return
    }
    if (!form.open_house_date_iso || !form.open_house_start_time || !form.open_house_end_time) {
      showToast('Please choose the open house date, start time, and end time.')
      return
    }
    const tz = form.property_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    const startAt = wallToISO(form.open_house_date_iso, form.open_house_start_time, tz)
    const endAt = wallToISO(form.open_house_date_iso, form.open_house_end_time, tz)
    if (!startAt || !endAt || endAt <= startAt) {
      showToast('The end time needs to be after the start time.')
      return
    }
    const hoursText = `${fmtTime12(form.open_house_start_time)} – ${fmtTime12(form.open_house_end_time)}`
    const fullAddress = `${form.street_address}${form.address_2 ? ' ' + form.address_2 : ''}, ${form.city}, ${form.state}${form.zip_code ? ' ' + form.zip_code : ''}`
    // Only clear report_sent_at when the SCHEDULE actually changed — a reschedule
    // should re-trigger the post-event report, but editing any other field must
    // not re-send a report that already went out. Compare by instant (DB and
    // toISOString() use different string formats for the same time).
    const timesChanged =
      !editingOH.start_at || !editingOH.end_at ||
      Date.parse(startAt) !== Date.parse(editingOH.start_at) ||
      Date.parse(endAt) !== Date.parse(editingOH.end_at)
    const update: Record<string, unknown> = {
      property_address: fullAddress,
      street_address: form.street_address,
      address_2: form.address_2,
      city: form.city,
      state: form.state,
      zip_code: form.zip_code,
      listing_price: form.listing_price,
      bedrooms: form.bedrooms,
      bathrooms: form.bathrooms,
      square_footage: form.square_footage,
      open_house_date: form.open_house_date,
      open_house_hours: hoursText,
      start_at: startAt,
      end_at: endAt,
      timezone: tz,
      listing_url: form.listing_url,
      code_word: smsCode,
      code_word_email: form.code_word_email,
      require_agreement: form.require_agreement,
      agreement_template_ids: form.agreement_template_ids.length > 0 ? form.agreement_template_ids : null,
    }
    if (timesChanged) update.report_sent_at = null
    const { error } = await supabase.from('open_houses').update(update).eq('id', editingOH.id)
    if (error) { showToast('Error updating: ' + error.message); return }
    setEditingOH(null)
    await loadOpenHouses(user.id)
    setView('dashboard')
    resetForm()
  }

  const deleteOpenHouse = async (ohId: string) => {
    // Server-side cascade delete (clears short_urls + visitors, then the open
    // house) — the client can't delete short_urls (locked by RLS), which is why
    // a direct client delete failed silently on a FK violation.
    const res = await fetch(`/api/open-house/${ohId}`, { method: 'DELETE', headers: await authHeaders() })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      showToast(json.error || 'Could not delete open house. Please try again.', 'error')
      return
    }
    setDeleteConfirm(null)
    setSelectedOH(null)
    setVisitors([])
    await loadOpenHouses(user.id)
    showToast('Open house deleted.')
  }

  const toggleVerified = async (visitorId: string, current: boolean) => {
    if (guardLocked()) return
    await supabase.from('visitors').update({ verified: !current }).eq('id', visitorId)
    setVisitors(visitors.map(v => v.id === visitorId ? { ...v, verified: !current } : v))
  }

  const exportCSV = () => {
    if (guardLocked()) return
    // Custom answers are free text and routinely contain commas, so every field
    // is now RFC-4180 quoted. Without this a single "Yes, pre-approved" answer
    // would shift each following column by one.
    const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`

    // One column per question actually answered by someone in this log, keyed
    // by question id but LABELLED with the prompt as it was asked.
    const questionColumns: { id: string; prompt: string }[] = []
    for (const v of visitors) {
      for (const a of normalizeCustomAnswers(v.custom_answers)) {
        if (!questionColumns.some(q => q.id === a.id)) {
          questionColumns.push({ id: a.id, prompt: a.prompt })
        }
      }
    }

    const headers = [
      'First Name','Last Name','Email','Phone','Timeline','Registered','Verified',
      ...questionColumns.map(q => q.prompt),
    ]
    const rows = visitors.map(v => {
      const answers = normalizeCustomAnswers(v.custom_answers)
      return [
        v.first_name, v.last_name, v.email, v.phone, v.purchasing_timeline,
        new Date(v.registered_at).toLocaleString(), v.verified ? 'Yes' : 'No',
        ...questionColumns.map(q => answers.find(a => a.id === q.id)?.answer ?? ''),
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedOH?.property_address}-visitors.csv`
    a.click()
  }

  const saveSettings = async () => {
    const hook = (profile?.zapier_webhook_url || '').trim()
    if (hook && !hook.startsWith('https://hooks.zapier.com/')) {
      showToast('Zapier webhook must start with https://hooks.zapier.com/', 'error')
      return
    }
    const crmEmail = (profile?.crm_lead_email || '').trim()
    if (crmEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(crmEmail)) {
      showToast('CRM lead email must be a valid email address', 'error')
      return
    }
    // Disclosure links: drop rows the agent left entirely blank, then require
    // both halves of anything they did start. Rejecting (rather than silently
    // dropping) a half-filled row makes a typo visible instead of quietly
    // meaning no visitor ever receives that document.
    const rawDisclosures: { label: string; url: string }[] =
      Array.isArray(profile?.disclosure_links) ? profile.disclosure_links : []
    const disclosures = rawDisclosures
      .map(r => ({ label: (r?.label || '').trim(), url: (r?.url || '').trim() }))
      .filter(r => r.label || r.url)
    for (const row of disclosures) {
      if (!row.label) {
        showToast('Give each disclosure a name visitors will see', 'error')
        return
      }
      if (!/^https:\/\//i.test(row.url)) {
        showToast(`Disclosure "${row.label}" needs a link starting with https://`, 'error')
        return
      }
    }
    // Custom questions: drop rows the agent added but never filled in, then
    // reject anything half-finished. A blank prompt or a choice question with
    // fewer than two real options would render as a dead end for the visitor.
    const rawQuestions: any[] = Array.isArray(profile?.custom_questions) ? profile.custom_questions : []
    const cleanedQuestions = rawQuestions
      .map(q => ({
        id: q?.id,
        prompt: (q?.prompt || '').trim(),
        type: q?.type === 'choice' ? 'choice' : 'text',
        options: Array.isArray(q?.options)
          ? q.options.map((o: string) => (o || '').trim()).filter(Boolean).slice(0, 4)
          : [],
        surface: q?.surface === 'signin' ? 'signin' : 'success',
      }))
      .filter(q => q.prompt || q.options.length > 0)
    for (const q of cleanedQuestions) {
      if (!q.prompt) {
        showToast('Give each of your questions something to ask', 'error')
        return
      }
      if (q.type === 'choice' && q.options.length < 2) {
        showToast(`"${q.prompt}" needs at least two choices`, 'error')
        return
      }
      if (q.type === 'text') q.options = []
    }
    if (cleanedQuestions.filter(q => q.surface === 'signin').length > 1) {
      showToast('Only one custom question can go on the sign-in form', 'error')
      return
    }
    if (cleanedQuestions.filter(q => q.surface === 'success').length > 2) {
      showToast('You can ask at most two questions after the tour', 'error')
      return
    }

    const { error } = await supabase.from('profiles').update({
      full_name: profile?.full_name,
      brokerage: profile?.brokerage,
      phone: profile?.phone,
      display_email: profile?.display_email,
      license_number: profile?.license_number,
      state: profile?.state,
      headshot_url: profile?.headshot_url,
      logo_url: profile?.logo_url,
      primary_color: profile?.primary_color,
      accent_color: profile?.accent_color,
      landing_page_url: profile?.landing_page_url,
      zapier_webhook_url: hook || null,
      crm_lead_email: crmEmail || null,
      crm_type: profile?.crm_type || null,
      disclosure_links: disclosures.length > 0 ? disclosures : null,
      custom_questions: cleanedQuestions.length > 0 ? cleanedQuestions : null,
    }).eq('id', user.id)
    if (error) { showToast('Error saving: ' + error.message); return }
    showToast('Settings saved!')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#f5f5f7' }}>
      <div style={{ fontSize: '16px', color: '#6e6e73' }}>Loading your dashboard...</div>
    </div>
  )

  const inputStyle = { width: '100%', background: '#f5f5f7', border: '1px solid #d1d1d6', borderRadius: '9px', padding: '9px 12px', fontSize: '13px', color: '#1d1d1f', outline: 'none', boxSizing: 'border-box' as const, fontFamily: "'Plus Jakarta Sans', sans-serif" }
  const labelStyle = { display: 'block' as const, fontSize: '11px', fontWeight: '600' as const, color: '#6e6e73', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '5px' }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />
      
      {/* Topbar */}
      <div style={{ background: primaryColor, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' }}>
        <div style={{ fontSize: '20px', fontWeight: '200', color: onPrimary, letterSpacing: '-0.5px' }}>
          oh<span style={{ fontWeight: '700' }}>ACCESS</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }} className="dash-nav-desktop">
          {navViews.map(v => (
            <button key={v} onClick={() => { setView(v); if (v !== 'new') setEditingOH(null) }} style={{ background: view === v ? navActiveBg : 'transparent', border: 'none', color: onPrimary, padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: view === v ? '600' : '400' }}>
              {navLabel(v)}
            </button>
          ))}
          <a href="/resources" target="_blank" rel="noopener noreferrer" style={{ color: onPrimary, fontSize: '13px', textDecoration: 'none', padding: '6px 14px' }}>
              Resources
            </a>
          <button onClick={signOut} style={{ background: 'transparent', border: `1px solid ${onPrimaryBorder}`, color: onPrimary, padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px' }}>
            Sign out
          </button>
        </div>
        <button className="dash-nav-mobile" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: 'none', border: 'none', color: onPrimary, fontSize: '22px', cursor: 'pointer', padding: '4px 8px' }}>
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {mobileMenuOpen && (
        <div style={{ background: primaryColor, borderTop: `1px solid ${primaryIsLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`, padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navViews.map(v => (
            <button key={v} onClick={() => { setView(v); if (v !== 'new') setEditingOH(null); setMobileMenuOpen(false) }}
              style={{ background: view === v ? navActiveBg : 'transparent', border: 'none', color: onPrimary, padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px', fontWeight: view === v ? '600' : '400', textAlign: 'left' as const }}>
              {navLabelMobile(v)}
            </button>
          ))}
          <a href="/resources" target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)}
            style={{ color: onPrimary, padding: '10px 14px', borderRadius: '8px', fontSize: '14px', fontWeight: '400', textDecoration: 'none', display: 'block' }}>
            📚 Resources
          </a>
          <button onClick={() => { signOut(); setMobileMenuOpen(false) }}
            style={{ background: 'transparent', border: `1px solid ${onPrimaryBorder}`, color: onPrimary, padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px', textAlign: 'left' as const, marginTop: '4px' }}>
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
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <div style={{ padding: '28px' }}>

        {/* TEAM PAYMENT BANNER — a member's team had a failed/overdue payment.
            They can't fix billing themselves, so point them at their admin.
            Access is retained during the grace period; if the team fully
            lapses the webhook unlinks them and they'll see plan options. */}
        {teamPaymentFailed && (
          <div style={{ background: '#fff9e0', border: '1px solid #ffe066', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ fontSize: '16px', lineHeight: '1.4' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#8a6400' }}>Your team&apos;s subscription needs attention</div>
              <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '3px', lineHeight: '1.5' }}>
                A recent payment on your team&apos;s ohACCESS plan didn&apos;t go through. Please contact your team/brokerage admin so your access isn&apos;t interrupted. Your open houses and visitor data are safe.
              </div>
            </div>
          </div>
        )}

        {/* LOCKED BANNER — free tier over the 50-registration cap. Shown on
            every view so the agent always sees why actions are disabled. */}
        {locked && (
          <div style={{ background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#cc0000' }}>⚠️ Your free trial has ended</div>
              <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '3px', lineHeight: '1.5' }}>
                You&apos;ve used all {trialLimit} free visitor registrations. Creating open houses, QR codes, editing, and CSV export are paused. Choose a plan to turn everything back on — your data is safe.
              </div>
            </div>
            <button onClick={() => setView('settings')} style={{ background: '#1d1d1f', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
              Choose a plan →
            </button>
          </div>
        )}

        {/* DISPLAY-EMAIL NUDGE — until the agent sets a public contact email,
            visitor replies and their copy of each sign-in go to their private
            login email. Soft, non-blocking; disappears once it's set (and is
            hidden on the Settings view where they'd fix it, or when locked). */}
        {profile && !profile.display_email?.trim() && view !== 'settings' && !locked && (
          <div style={{ background: '#eef4ff', border: '1px solid #cfe0ff', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '16px', lineHeight: '1.4' }}>✉️</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0040a0' }}>Add your public contact email</div>
                <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '3px', lineHeight: '1.5' }}>
                  Set a <strong>Display Email</strong> so visitor replies and your copy of each sign-in reach the inbox you choose — and your private login email stays private. Until then we fall back to your login email.
                </div>
              </div>
            </div>
            <button onClick={() => setView('settings')} style={{ background: '#0071e3', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
              Add it in Settings →
            </button>
          </div>
        )}

        {/* DASHBOARD VIEW */}
        {view === 'dashboard' && (
          <OpenHouseList
            user={user}
            openHouses={openHouses}
            selectedOH={selectedOH}
            visitors={visitors}
            isPaidTier={isPaidTier}
            sponsored={!!profile?.sponsor_id}
            trialLimit={trialLimit}
            locked={locked}
            primaryColor={primaryColor}
            onPrimary={onPrimary}
            primaryBtnBorder={primaryBtnBorder}
            accentColor={accentColor}
            onAccent={onAccent}
            accentBtnBorder={accentBtnBorder}
            accentText={accentText}
            setSelectedOH={setSelectedOH}
            loadVisitors={loadVisitors}
            guardLocked={guardLocked}
            startEdit={startEdit}
            exportCSV={exportCSV}
            toggleVerified={toggleVerified}
            setView={setView}
            setEditingOH={setEditingOH}
            resetForm={resetForm}
            setQrModal={setQrModal}
            openPermanentQr={openPermanentQr}
            openSellerReport={openSellerReport}
            openInvites={(oh: any) => setInviteModal(oh)}
            setDeleteConfirm={setDeleteConfirm}
            setVisitorModal={setVisitorModal}
            showToast={showToast}
          />
        )}

        {/* NEW / EDIT OPEN HOUSE VIEW */}
        {view === 'new' && (
          <NewOpenHouseForm
            editingOH={editingOH}
            locked={locked}
            form={form}
            setForm={setForm}
            showCal={showCal}
            setShowCal={setShowCal}
            calDate={calDate}
            setCalDate={setCalDate}
            addressSuggestions={addressSuggestions}
            showSuggestions={showSuggestions}
            setShowSuggestions={setShowSuggestions}
            getAddressSuggestions={getAddressSuggestions}
            selectAddress={selectAddress}
            generateSmsWord={generateSmsWord}
            generateEmailWord={generateEmailWord}
            createOpenHouse={createOpenHouse}
            updateOpenHouse={updateOpenHouse}
            resetForm={resetForm}
            setView={setView}
            setEditingOH={setEditingOH}
            agreementTemplates={normalizeAgreementTemplates(profile?.agreement_templates)}
            primaryColor={primaryColor}
            onPrimary={onPrimary}
            primaryBtnBorder={primaryBtnBorder}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
          />
        )}

        {/* SETTINGS VIEW */}
        {view === 'settings' && (
          <SettingsPanel
            profile={profile}
            setProfile={setProfile}
            agentId={user?.id}
            showToast={showToast}
            onSubscriptionChanged={async () => { await loadProfile(user.id); await loadTeamStatus() }}
            isTeamMember={isTeamMember}
            teamPaymentFailed={teamPaymentFailed}
            isTeamAdmin={isTeamAdmin}
            sponsorCovered={sponsorCovered}
            formatPhone={formatPhone}
            saveSettings={saveSettings}
            primaryColor={primaryColor}
            onPrimary={onPrimary}
            primaryBtnBorder={primaryBtnBorder}
            accentColor={accentColor}
            onAccent={onAccent}
            accentBtnBorder={accentBtnBorder}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
          />
        )}

        {/* TEAM VIEW (team-lead only) */}
        {view === 'team' && isTeamAdmin && (
          <TeamAdminPanel supabase={supabase} showToast={showToast} onSaved={() => loadProfile(user.id)} />
        )}

        {/* BROKERAGE ACTIVITY VIEW (team-lead only) — every agent's open
            houses + visitor logs across the whole brokerage. */}
        {view === 'activity' && isTeamAdmin && (
          <TeamActivityPanel supabase={supabase} showToast={showToast} primaryColor={primaryColor} accentColor={accentColor} />
        )}

      </div>
{/* QR CODE MODAL */}
      {/* INVITE PAST VISITORS MODAL */}
      {inviteModal && (
        <InviteModal
          oh={inviteModal}
          onClose={() => setInviteModal(null)}
          showToast={showToast}
          authHeaders={authHeaders}
          accentColor={accentColor}
          onAccent={onAccent}
          accentBtnBorder={accentBtnBorder}
        />
      )}

      {qrModal && (
        <QrModal
          data={qrModal}
          onClose={() => setQrModal(null)}
          showToast={showToast}
          primaryColor={primaryColor}
          onPrimary={onPrimary}
          primaryBtnBorder={primaryBtnBorder}
          accentColor={accentColor}
          onAccent={onAccent}
          accentBtnBorder={accentBtnBorder}
          logoUrl={profile?.logo_url || ''}
        />
      )}

      {/* VISITOR DETAIL PANEL — opens when a visitor name is clicked */}
      {visitorModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}
          onClick={() => setVisitorModal(null)}>
          <div style={{ background: 'white', borderRadius: '24px', padding: '24px', maxWidth: '440px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
              <button onClick={() => setVisitorModal(null)} style={{ background: 'none', border: 'none', color: '#aeaeb2', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}>✕</button>
            </div>
            <VisitorDetail
              visitor={visitorModal}
              supabase={supabase}
              primaryColor={primaryColor}
              accentColor={accentColor}
              requireAgreement={!!openHouses.find(oh => oh.id === visitorModal.open_house_id)?.require_agreement}
              onChange={(fields) => {
                setVisitors(prev => prev.map(v => v.id === visitorModal.id ? { ...v, ...fields } : v))
                setVisitorModal((vm: any) => vm ? { ...vm, ...fields } : vm)
              }}
              onDelete={() => {
                setVisitors(prev => prev.filter(v => v.id !== visitorModal.id))
                setVisitorModal(null)
                showToast('Visitor deleted.')
              }}
            />
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#1d1d1f' : '#cc0000',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '600',
          zIndex: 2000,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease'
        }}>
          {toast.type === 'success' ? '✓' : '⚠️'} {toast.message}
        </div>
      )}

      {deleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '22px', padding: '32px', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🗑</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1d1d1f', marginBottom: '8px' }}>Delete this open house?</div>
            <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '24px', lineHeight: '1.6' }}>
              This will permanently delete the open house and all visitor records. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '10px 24px', background: '#f5f5f7', color: '#1d1d1f', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
              <button onClick={() => deleteOpenHouse(deleteConfirm)} style={{ padding: '10px 24px', background: '#cc0000', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Yes, delete it</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
