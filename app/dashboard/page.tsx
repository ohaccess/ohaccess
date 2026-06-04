'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import TeamAdminPanel from './_components/TeamAdminPanel'
import TeamActivityPanel from './_components/TeamActivityPanel'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
    code_word_email: ''
  })
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)
  const [totalVisitors, setTotalVisitors] = useState<number | null>(null)
  const [teamStatus, setTeamStatus] = useState<{ subscription_status: string | null } | null>(null)

  const primaryColor = profile?.primary_color || '#1d1d1f'
  const accentColor = profile?.accent_color || '#0071e3'

  // Team-admin (team-lead) gets a Team tab; everyone else sees the standard nav.
  const isTeamAdmin = profile?.role === 'brokerage_admin'
  // A non-admin agent who belongs to a team doesn't manage billing — the team
  // lead does — so they don't see the Subscription section. If they're later
  // removed (brokerage_id cleared), it reappears.
  const isTeamMember = !!profile?.brokerage_id && profile?.role !== 'brokerage_admin'

  // A 2-year prepay is a one-time payment with no auto-renew, so its row still
  // reads tier=paid after it lapses. Treat a past access date as expired so the
  // agent gets the renewal prompt (and the trial cap) like any free agent.
  const twoYearExpired =
    profile?.billing_interval === 'two_year_prepay' &&
    !!profile?.current_period_end &&
    Date.parse(profile.current_period_end) < Date.now()

  // A team member's access depends on the TEAM's billing health, not their own
  // row. If the team payment failed (past_due), warn them but keep access; if
  // the team fully lapsed the webhook already unlinked them to free.
  const teamPaymentFailed = isTeamMember && teamStatus?.subscription_status === 'past_due'

  // Free-tier agents who've used all 50 trial registrations are locked out of
  // every action until they upgrade. This also catches agents who were removed
  // from a team (they drop to free) and are already over the cap.
  const isPaidTier =
    ['pro', 'team', 'brokerage'].includes(profile?.tier || 'free') && !twoYearExpired
  const locked = !isPaidTier && (totalVisitors ?? 0) >= 50
  const guardLocked = (): boolean => {
    if (locked) {
      showToast('You’ve used all 50 free registrations. Upgrade to keep using ohACCESS.', 'error')
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

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa']

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
      setUser(refreshData.session.user)
      await loadProfile(refreshData.session.user.id)
      await loadOpenHouses(refreshData.session.user.id)
      await loadVisitorCount(refreshData.session.user.id)
      await loadTeamStatus()
      setLoading(false)
      return
    }
    setUser(session.user)
    await loadProfile(session.user.id)
    await loadOpenHouses(session.user.id)
    await loadVisitorCount(session.user.id)
    await loadTeamStatus()
    setLoading(false)
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
    if (data) setVisitors(data)
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
    open_house_hours: '', property_timezone: '', listing_url: '', code_word: '', code_word_email: ''
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
      showToast('Please fill in the address, city, state, and both code words (text + email).')
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
      code_word: form.code_word,
      code_word_email: form.code_word_email,
      status: 'active'
    }).select()
    if (error) { showToast('Error saving: ' + error.message); return }
    if (data) { await loadOpenHouses(user.id); setView('dashboard'); resetForm() }
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
      code_word: oh.code_word || '',
      code_word_email: oh.code_word_email || ''
    })
    setView('new')
  }

  const updateOpenHouse = async () => {
    if (guardLocked()) return
    if (!form.street_address || !form.city || !form.state || !form.code_word || !form.code_word_email) {
      showToast('Please fill in the address, city, state, and both code words (text + email).')
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
    // Editing the time clears report_sent_at so a rescheduled open house can
    // still trigger a fresh post-event report.
    const { error } = await supabase.from('open_houses').update({
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
      report_sent_at: null,
      listing_url: form.listing_url,
      code_word: form.code_word,
      code_word_email: form.code_word_email,
    }).eq('id', editingOH.id)
    if (error) { showToast('Error updating: ' + error.message); return }
    setEditingOH(null)
    await loadOpenHouses(user.id)
    setView('dashboard')
    resetForm()
  }

  const deleteOpenHouse = async (ohId: string) => {
    await supabase.from('visitors').delete().eq('open_house_id', ohId)
    await supabase.from('open_houses').delete().eq('id', ohId)
    setDeleteConfirm(null)
    setSelectedOH(null)
    setVisitors([])
    await loadOpenHouses(user.id)
  }

  const toggleVerified = async (visitorId: string, current: boolean) => {
    if (guardLocked()) return
    await supabase.from('visitors').update({ verified: !current }).eq('id', visitorId)
    setVisitors(visitors.map(v => v.id === visitorId ? { ...v, verified: !current } : v))
  }

  const exportCSV = () => {
    if (guardLocked()) return
    const headers = ['First Name','Last Name','Email','Phone','Timeline','Registered','Verified']
    const rows = visitors.map(v => [v.first_name, v.last_name, v.email, v.phone, v.purchasing_timeline, new Date(v.registered_at).toLocaleString(), v.verified ? 'Yes' : 'No'])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedOH?.property_address}-visitors.csv`
    a.click()
  }

  const saveSettings = async () => {
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
    }).eq('id', user.id)
    if (error) { showToast('Error saving: ' + error.message); return }
    showToast('Settings saved!')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const getTimelineBadge = (timeline: string) => {
    const colors: any = {
      '0–1 Month': { bg: '#fff0e6', color: '#b84800' },
      '2–3 Months': { bg: '#fff9e0', color: '#8a6400' },
      '3–6 Months': { bg: '#e5f0ff', color: '#0040a0' },
      '6–12 Months': { bg: '#e5f0ff', color: '#0040a0' },
      '12+ Months': { bg: '#f2f2f7', color: '#555' }
    }
    const c = colors[timeline] || { bg: '#f2f2f7', color: '#555' }
    return <span style={{ background: c.bg, color: c.color, padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{timeline}</span>
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#f5f5f7' }}>
      <div style={{ fontSize: '16px', color: '#6e6e73' }}>Loading your dashboard...</div>
    </div>
  )

  const inputStyle = { width: '100%', background: '#f5f5f7', border: '1px solid #d1d1d6', borderRadius: '9px', padding: '9px 12px', fontSize: '13px', color: '#1d1d1f', outline: 'none', boxSizing: 'border-box' as const, fontFamily: "'Plus Jakarta Sans', sans-serif" }
  const labelStyle = { display: 'block' as const, fontSize: '11px', fontWeight: '600' as const, color: '#6e6e73', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '5px' }
  const firstDay = new Date(calDate.getFullYear(), calDate.getMonth(), 1).getDay()
  const daysInMonth = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0).getDate()

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />
      
      {/* Topbar */}
      <div style={{ background: primaryColor, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' }}>
        <div style={{ fontSize: '20px', fontWeight: '200', color: 'white', letterSpacing: '-0.5px' }}>
          oh<span style={{ fontWeight: '700' }}>ACCESS</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }} className="dash-nav-desktop">
          {navViews.map(v => (
            <button key={v} onClick={() => { setView(v); if (v !== 'new') setEditingOH(null) }} style={{ background: view === v ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', color: view === v ? 'white' : 'rgba(255,255,255,0.6)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: view === v ? '600' : '400' }}>
              {navLabel(v)}
            </button>
          ))}
          <a href="/resources" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', textDecoration: 'none', padding: '6px 14px' }}>
              Resources
            </a>
          <button onClick={signOut} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px' }}>
            Sign out
          </button>
        </div>
        <button className="dash-nav-mobile" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '22px', cursor: 'pointer', padding: '4px 8px' }}>
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {mobileMenuOpen && (
        <div style={{ background: primaryColor, borderTop: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navViews.map(v => (
            <button key={v} onClick={() => { setView(v); if (v !== 'new') setEditingOH(null); setMobileMenuOpen(false) }}
              style={{ background: view === v ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', color: 'white', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px', fontWeight: view === v ? '600' : '400', textAlign: 'left' as const }}>
              {navLabelMobile(v)}
            </button>
          ))}
          <a href="/resources" onClick={() => setMobileMenuOpen(false)}
            style={{ color: 'white', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', fontWeight: '400', textDecoration: 'none', display: 'block' }}>
            📚 Resources
          </a>
          <button onClick={() => { signOut(); setMobileMenuOpen(false) }}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px', textAlign: 'left' as const, marginTop: '4px' }}>
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
                You&apos;ve used all 50 free visitor registrations. Creating open houses, QR codes, editing, and CSV export are paused. Choose a plan to turn everything back on — your data is safe.
              </div>
            </div>
            <button onClick={() => setView('settings')} style={{ background: '#1d1d1f', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
              Choose a plan →
            </button>
          </div>
        )}

        {/* DASHBOARD VIEW */}
        {view === 'dashboard' && (
          <>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>Dashboard</div>
            <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '16px' }}>Real-time visitor log and open house management.</div>

            {!isPaidTier && !locked && (
              <TrialBanner agentId={user?.id} supabase={supabase} accentColor={accentColor} />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'Active Open Houses', value: openHouses.filter(oh => oh.status === 'active').length },
                { label: 'Total Registrations', value: visitors.length, accent: true },
                { label: 'Verified at Door', value: visitors.filter(v => v.verified).length }
              ].map(stat => (
                <div key={stat.label} style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '16px 18px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '500', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{stat.label}</div>
                  <div style={{ fontSize: '28px', fontWeight: '600', color: stat.accent ? accentColor : '#1d1d1f', letterSpacing: '-1px' }}>{stat.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f' }}>Your open houses</div>
              <button disabled={locked} onClick={() => { if (guardLocked()) return; setEditingOH(null); resetForm(); setView('new') }} style={{ background: accentColor, color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                + New open house
              </button>
            </div>

            {openHouses.length === 0 ? (
              <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '40px', textAlign: 'center', color: '#6e6e73', marginBottom: '20px' }}>
                No open houses yet. Create your first one!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {openHouses.map(oh => (
                  <div key={oh.id} style={{ background: 'white', border: `1px solid ${selectedOH?.id === oh.id ? accentColor : '#d1d1d6'}`, borderRadius: '18px', padding: '14px 18px', cursor: 'pointer' }}
                    onClick={async () => { setSelectedOH(oh); await loadVisitors(oh.id) }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: oh.status === 'active' ? accentColor : '#aeaeb2', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{oh.property_address}</div>
                        <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '2px' }}>{oh.open_house_date} · {oh.open_house_hours} · 📱 <strong>{oh.code_word}</strong> · ✉️ <strong>{oh.code_word_email || oh.code_word}</strong></div>
                      </div>
                      {oh.status === 'active' && (
                        <div style={{ background: '#e8f9ee', color: '#1a7a3c', fontSize: '11px', fontWeight: '600', padding: '3px 9px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#30d158' }} />Live
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'nowrap' }} onClick={e => e.stopPropagation()}>
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
                      }} style={{ background: accentColor, color: 'white', border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '10px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>📱 QR Code</button>
                      <button disabled={locked} onClick={(e) => {
                        e.stopPropagation()
                        if (guardLocked()) return
                        const url = `${window.location.origin}/register/${oh.id}`
                        navigator.clipboard.writeText(url)
                        showToast('Registration URL copied!')
                      }} style={{ background: primaryColor, color: 'white', border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '10px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>📋 Copy URL</button>
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
                  <button disabled={locked} onClick={exportCSV} style={{ background: primaryColor, color: 'white', border: 'none', padding: '6px 13px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Export CSV</button>
                </div>
                {visitors.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#6e6e73', padding: '20px', fontSize: '13px' }}>No visitors yet. Share your QR code to get started!</div>
                ) : (
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '500px' }}>
                      <thead>
                        <tr>
                          {['Name','Phone','Email','Timeline','Time','✓'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '8px', fontSize: '10px', fontWeight: '600', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #d1d1d6', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visitors.map((v, i) => (
                          <tr key={v.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ padding: '8px', borderBottom: '1px solid #f2f2f7', color: '#6e6e73', whiteSpace: 'nowrap' }}>{v.first_name} {v.last_name}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #f2f2f7', color: '#6e6e73', whiteSpace: 'nowrap' }}>{v.phone}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #f2f2f7', color: '#6e6e73', whiteSpace: 'nowrap' }}>{v.email}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #f2f2f7', whiteSpace: 'nowrap' }}>{getTimelineBadge(v.purchasing_timeline)}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #f2f2f7', color: '#6e6e73', whiteSpace: 'nowrap' }}>{new Date(v.registered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #f2f2f7', whiteSpace: 'nowrap' }}>
                              <button disabled={locked} onClick={() => toggleVerified(v.id, v.verified)} style={{ background: v.verified ? '#30d158' : primaryColor, color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
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
        )}

        {/* NEW / EDIT OPEN HOUSE VIEW */}
        {view === 'new' && (
          <>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>{editingOH ? 'Edit open house' : 'New open house'}</div>
            <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '24px' }}>{editingOH ? 'Update your listing details.' : 'Set up your listing and generate your QR code.'}</div>

            <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Property details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                {/* Street address with autocomplete */}
                <div style={{ position: 'relative' }}>
                  <label style={labelStyle}>Street Address <span style={{ color: '#ff3b30' }}>*</span></label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="Start typing address..."
                    value={form.street_address}
                    onChange={e => {
                      setForm({ ...form, street_address: e.target.value })
                      getAddressSuggestions(e.target.value)
                    }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  />
                  {showSuggestions && addressSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d1d6', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden', marginTop: '4px' }}>
                      {addressSuggestions.map((s: any) => (
                        <div
                          key={s.place_id}
                          onMouseDown={() => selectAddress(s.place_id)}
                          style={{ padding: '10px 14px', fontSize: '13px', color: '#1d1d1f', cursor: 'pointer', borderBottom: '1px solid #f2f2f7' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f7')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                        >
                          <div style={{ fontWeight: '600' }}>{s.structured_formatting?.main_text}</div>
                          <div style={{ fontSize: '11px', color: '#6e6e73' }}>{s.structured_formatting?.secondary_text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Unit / Suite / Apt</label>
                  <input style={inputStyle} type="text" placeholder="Unit 4B" value={form.address_2} onChange={e => setForm({ ...form, address_2: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>City <span style={{ color: '#ff3b30' }}>*</span></label>
                  <input style={inputStyle} type="text" placeholder="Auto-filled" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>State <span style={{ color: '#ff3b30' }}>*</span></label>
                  <input style={inputStyle} type="text" placeholder="Auto-filled" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Zip Code</label>
                  <input style={inputStyle} type="text" placeholder="Auto-filled" value={form.zip_code} onChange={e => setForm({ ...form, zip_code: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Listing Price</label>
                  <input style={inputStyle} type="text" placeholder="$625,000" value={form.listing_price} onChange={e => setForm({ ...form, listing_price: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Square Footage</label>
                  <input style={inputStyle} type="text" placeholder="2,450 sq ft" value={form.square_footage} onChange={e => setForm({ ...form, square_footage: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Bedrooms</label>
                  <input style={inputStyle} type="text" placeholder="4" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Bathrooms</label>
                  <input style={inputStyle} type="text" placeholder="3" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })} />
                </div>
                <div style={{ position: 'relative' }}>
                  <label style={labelStyle}>Open House Date</label>
                  <input style={{ ...inputStyle, cursor: 'pointer' }} type="text" placeholder="Select a date" value={form.open_house_date} readOnly onClick={() => setShowCal(!showCal)} />
                  {showCal && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100, background: 'white', border: '1px solid #d1d1d6', borderRadius: '18px', padding: '14px', width: '242px', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <button onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth()-1, 1))} style={{ background: primaryColor, color: 'white', border: 'none', borderRadius: '7px', padding: '4px 10px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>‹</button>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f' }}>{MONTHS[calDate.getMonth()]} {calDate.getFullYear()}</span>
                        <button onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth()+1, 1))} style={{ background: primaryColor, color: 'white', border: 'none', borderRadius: '7px', padding: '4px 10px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>›</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                        {DOW.map(d => <div key={d} style={{ fontSize: '10px', fontWeight: '600', color: '#aeaeb2', textAlign: 'center', padding: '3px 0' }}>{d}</div>)}
                        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1
                          return (
                            <div key={day} onClick={() => { const d = new Date(calDate.getFullYear(), calDate.getMonth(), day); const p = (n: number) => String(n).padStart(2, '0'); setForm({ ...form, open_house_date: `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${day}, ${d.getFullYear()}`, open_house_date_iso: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(day)}` }); setShowCal(false) }}
                              style={{ fontSize: '12px', textAlign: 'center', padding: '5px 2px', borderRadius: '6px', cursor: 'pointer', color: '#1d1d1f' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#e8e8ed')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >{day}</div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Open House Hours</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input style={inputStyle} type="time" value={form.open_house_start_time} onChange={e => setForm({ ...form, open_house_start_time: e.target.value })} />
                    <span style={{ color: '#6e6e73', fontSize: '13px' }}>to</span>
                    <input style={inputStyle} type="time" value={form.open_house_end_time} onChange={e => setForm({ ...form, open_house_end_time: e.target.value })} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#aeaeb2', marginTop: '4px' }}>We&apos;ll email you a visitor report about 30 minutes after it ends.</div>
                </div>
                <div>
                  <label style={labelStyle}>Listing URL (your site, Zill*w, H*omes)</label>
                  <input style={inputStyle} type="url" placeholder="https://yourbrokerage.com/listing" value={form.listing_url} onChange={e => setForm({ ...form, listing_url: e.target.value })} />
                </div>
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '6px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Access code words</div>
              <div style={{ fontSize: '12px', color: '#6e6e73', margin: '12px 0 16px', lineHeight: '1.5' }}>
                Each visitor gets two codes — one by text, one by email. At the door, ask for the <strong>text code</strong> first (a real phone is hard to fake); accept the email code only if their text didn&apos;t arrive.
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                {/* Text (SMS) code — primary */}
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <label style={labelStyle}>📱 Text code (SMS) — primary</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input style={{ ...inputStyle, fontWeight: '700', letterSpacing: '2px', fontSize: '15px' }} type="text" placeholder="e.g. LOVELY" value={form.code_word} onChange={e => setForm({ ...form, code_word: e.target.value.toUpperCase() })} />
                    </div>
                    <button onClick={() => setForm({ ...form, code_word: generateSmsWord() })} style={{ padding: '9px 14px', background: primaryColor, color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
                      ✦ Auto-generate
                    </button>
                  </div>
                </div>

                {/* Email code — fallback */}
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <label style={labelStyle}>✉️ Email code — fallback</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input style={{ ...inputStyle, fontWeight: '700', letterSpacing: '2px', fontSize: '15px' }} type="text" placeholder="e.g. TUDOR" value={form.code_word_email} onChange={e => setForm({ ...form, code_word_email: e.target.value.toUpperCase() })} />
                    </div>
                    <button onClick={() => setForm({ ...form, code_word_email: generateEmailWord() })} style={{ padding: '9px 14px', background: primaryColor, color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
                      ✦ Auto-generate
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => { setView('dashboard'); setEditingOH(null); resetForm() }} style={{ padding: '9px 18px', background: '#e8e8ed', color: '#1d1d1f', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
              <button disabled={locked} onClick={editingOH ? updateOpenHouse : createOpenHouse} style={{ padding: '9px 18px', background: primaryColor, color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {editingOH ? '✓ Update open house' : '✓ Save open house'}
              </button>
            </div>
          </>
        )}

        {/* SETTINGS VIEW */}
        {view === 'settings' && (
          <>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>Account settings</div>
            <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '24px' }}>Manage your profile, branding, and preferences.</div>

            {isTeamMember ? (
              <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '8px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Subscription</div>
                {teamPaymentFailed ? (
                  <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.5' }}>
                    ⚠️ Your team&apos;s most recent payment didn&apos;t go through. Please contact your team/brokerage admin so your access isn&apos;t interrupted — there&apos;s nothing for you to pay directly.
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: '1.5' }}>
                    ✓ You&apos;re covered under your team&apos;s plan. Billing is managed by your team lead — there&apos;s nothing for you to pay.
                  </div>
                )}
              </div>
            ) : (
              <SubscriptionSection
                profile={profile}
                agentId={user?.id}
                supabase={supabase}
                showToast={showToast}
                onChanged={async () => { await loadProfile(user.id); await loadTeamStatus() }}
              />
            )}

            <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Agent profile</div>
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
                      <div style={{ fontSize: '11px', color: '#6e6e73', marginTop: '4px' }}>
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
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Branding & photos</div>
              <div style={{ fontSize: '12px', color: '#6e6e73', marginBottom: '16px' }}>
                Paste direct image URLs ending in .jpg or .png. Headshot and logo appear in visitor emails.
                <strong style={{ color: '#1d1d1f' }}> Tip: Upload your photo to <a href="https://imgur.com" target="_blank" style={{ color: '#0071e3' }}>imgur.com</a> for a reliable direct link.</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Agent Landing Page URL</label>
                  <input style={inputStyle} type="url" placeholder="https://yourwebsite.com/bio" value={profile?.landing_page_url || ''} onChange={e => setProfile({ ...profile, landing_page_url: e.target.value })} />
                  <div style={{ fontSize: '11px', color: '#6e6e73', marginTop: '4px' }}>Your bio page, Instagram, or Linktree. Appears in visitor emails and texts.</div>
                </div>
                <div>
                  <label style={labelStyle}>Agent Headshot URL</label>
                  <input style={inputStyle} type="url" placeholder="https://yoursite.com/headshot.jpg" value={profile?.headshot_url || ''} onChange={e => setProfile({ ...profile, headshot_url: e.target.value })} />
                  {profile?.headshot_url && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={profile.headshot_url} alt="Headshot" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #d1d1d6' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      <span style={{ fontSize: '11px', color: '#30d158', fontWeight: '600' }}>✓ Preview loaded</span>
                    </div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Logo URL (Brokerage or Team)</label>
                  {profile?.brokerage_id ? (
                    <div style={{ background: '#f5f5f7', border: '1px solid #d1d1d6', borderRadius: '9px', padding: '10px 12px', fontSize: '12px', color: '#6e6e73', lineHeight: '1.5' }}>
                      🔒 Your team controls the logo.{isTeamAdmin ? ' Manage it in the Team tab.' : ' Contact your team lead to change it.'}
                    </div>
                  ) : (
                    <>
                      <input style={inputStyle} type="url" placeholder="https://yoursite.com/logo.png" value={profile?.logo_url || ''} onChange={e => setProfile({ ...profile, logo_url: e.target.value })} />
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
                    </>
                  )}
                </div>
              </div>
            </div>

            {profile?.brokerage_id ? (
              <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Brand colors</div>
                <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '12px', lineHeight: '1.5' }}>
                  🔒 Your team&apos;s colors are applied to your visitor emails.
                  {isTeamAdmin ? ' Manage your team branding in the Team tab.' : ' Contact your team lead to change them.'}
                </div>
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Brand colors</div>
                <div style={{ fontSize: '12px', color: '#6e6e73', marginBottom: '16px' }}>Applied to your visitor registration form and email header.</div>
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
                  <div style={{ fontSize: '12px', color: '#6e6e73' }}>Preview:</div>
                  <div style={{ background: profile?.primary_color || '#1d1d1f', color: 'white', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>oh<strong>ACCESS</strong></div>
                  <div style={{ background: profile?.accent_color || '#0071e3', color: 'white', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>Button</div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
              <button onClick={saveSettings} style={{ padding: '9px 18px', background: primaryColor, color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                ✓ Save settings
              </button>
            </div>
          </>
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
      {qrModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}
          onClick={() => setQrModal(null)}>
          <div style={{ background: 'white', borderRadius: '24px', padding: '28px', maxWidth: '380px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1d1d1f', marginBottom: '3px' }}>
                {qrModal.oh.street_address || qrModal.oh.property_address}
              </div>
              <div style={{ fontSize: '13px', color: '#6e6e73' }}>
                {qrModal.oh.open_house_date} · {qrModal.oh.open_house_hours}
              </div>
            </div>

            {/* QR Code */}
            <div style={{ background: '#f5f5f7', borderRadius: '16px', padding: '20px', marginBottom: '20px', display: 'inline-block' }}>
              <img src={qrModal.dataUrl} alt="QR Code" style={{ width: '200px', height: '200px', display: 'block' }} />
            </div>

            <div style={{ fontSize: '12px', color: '#6e6e73', marginBottom: '20px' }}>
              Visitors scan this code to register and receive their access code
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => {
                const a = document.createElement('a')
                a.href = qrModal.dataUrl
                a.download = `ohaccess-qr-${qrModal.oh.property_address.replace(/\s+/g, '-')}.png`
                a.click()
              }} style={{ background: primaryColor, color: 'white', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                📥 Download PNG
              </button>

              <button onClick={() => {
                navigator.clipboard.writeText(qrModal.url)
                showToast('Registration URL copied!')
              }} style={{ background: '#f5f5f7', color: '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                📋 Copy registration URL
              </button>

              {navigator.share && (
                <button onClick={async () => {
                  try {
                    const file = new File([qrModal.blob], `ohaccess-qr.png`, { type: 'image/png' })
                    await navigator.share({
                      title: `ohACCESS QR — ${qrModal.oh.street_address || qrModal.oh.property_address}`,
                      text: `Scan to register for the open house at ${qrModal.oh.property_address}`,
                      files: [file]
                    })
                  } catch (err) {
                    console.log('Share cancelled')
                  }
                }} style={{ background: accentColor, color: 'white', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  📤 Share QR Code
                </button>
              )}

              {/* Add to calendar — only when the open house has a scheduled time */}
              {qrModal.oh.start_at && qrModal.oh.end_at && (() => {
                const z = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
                const title = encodeURIComponent(`Open House — ${qrModal.oh.property_address || ''}`)
                const loc = encodeURIComponent(qrModal.oh.property_address || '')
                const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${z(qrModal.oh.start_at)}/${z(qrModal.oh.end_at)}&location=${loc}`
                const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${encodeURIComponent(qrModal.oh.start_at)}&enddt=${encodeURIComponent(qrModal.oh.end_at)}&location=${loc}&path=/calendar/action/compose&rru=addevent`
                const ics = `/api/open-house/${qrModal.oh.id}/calendar`
                const calBtn = { flex: 1, textAlign: 'center' as const, background: '#f5f5f7', color: '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif" }
                return (
                  <div style={{ borderTop: '1px solid #f2f2f7', paddingTop: '12px', marginTop: '2px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>📅 Add to calendar</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a href={gcal} target="_blank" rel="noopener noreferrer" style={calBtn}>Google</a>
                      <a href={outlook} target="_blank" rel="noopener noreferrer" style={calBtn}>Outlook</a>
                      <a href={ics} style={calBtn}>Apple / .ics</a>
                    </div>
                  </div>
                )
              })()}

              <button onClick={() => setQrModal(null)} style={{ background: 'none', border: 'none', color: '#aeaeb2', fontSize: '13px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '4px' }}>
                Close
              </button>
            </div>
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

function TrialBanner({ agentId, supabase, accentColor }: { agentId: string, supabase: any, accentColor: string }) {
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

  const remaining = Math.max(0, 50 - count)
  const isExpired = count >= 50
  const isWarning = count >= 35

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
            : `✓ Free trial — ${remaining} of 50 visitor registrations remaining`
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
    sub: { month: 'For the active agent', year: '$150/yr — 2 months free', two_year_prepay: '$240 once — year 2 half off' },
    cta: 'Upgrade to Pro',
  },
  {
    name: 'Team', tier: 'team', featured: false,
    price: { month: '$120', year: '$100', two_year_prepay: '$80' }, per: '/mo',
    sub: { month: 'Up to 10 agents', year: '$1,200/yr — 2 months free', two_year_prepay: '$1,920 once — year 2 half off' },
    cta: 'Start Team',
  },
  {
    name: 'Brokerage', tier: 'brokerage', featured: false,
    price: { month: 'Custom', year: 'Custom', two_year_prepay: 'Custom' }, per: '',
    sub: { month: 'Custom per-agent pricing', year: 'Custom per-agent pricing', two_year_prepay: 'Custom per-agent pricing' },
    cta: 'Contact us',
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
  if (interval === 'two_year_prepay') return '2-Year Prepay'
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

  // A 2-year prepay is one-time with no auto-renew, so its row still reads
  // paid/active after the access date passes. Treat that as expired so the
  // agent sees the renewal picker.
  const twoYearExpired =
    billing === 'two_year_prepay' && !!periodEnd && Date.parse(periodEnd) < Date.now()
  // Show the plan picker for free agents AND at the "renew" moment (expired 2-year).
  const showPlans = isFree || twoYearExpired
  // cancel_at_period_end keeps status 'active' until the period closes;
  // canceledAt is our flag that an end is already scheduled.
  const pendingCancel = !!canceledAt && (status === 'active' || status === 'trialing')
  // Only recurring (month/year) plans can be canceled; 2-year prepay just lapses.
  const canCancel = isPaid && !twoYearExpired && (billing === 'month' || billing === 'year')
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
    // Brokerage is custom-priced — route to the sales contact form.
    if (tier === 'brokerage') { window.location.href = '/contact'; return }
    setBusy(tier)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { showToast('Please sign in again.', 'error'); setBusy(null); return }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tier, interval }),
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
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Subscription</div>

      {showPlans && (
        <>
          {isFree ? (
            <>
              <div style={{ fontSize: '14px', color: '#1d1d1f', marginBottom: '4px' }}>
                <strong>Plan:</strong> Free trial
              </div>
              <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '18px' }}>
                {Math.max(0, 50 - visitorCount)} of 50 visitor registrations remaining
              </div>
            </>
          ) : (
            <div style={{ background: '#fff9e0', border: '1px solid #ffe066', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#8a6400' }}>Your 2-year plan has ended</div>
              <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '3px', lineHeight: '1.5' }}>
                Your prepaid access ended on {formatPlanDate(periodEnd)}. Choose a plan below to pick up right where you left off — your data is safe.
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
              * 2-year prepay is a founding-member offer available for a limited time.
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
          <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '6px' }}>
            <strong>Status:</strong> {status === 'past_due'
              ? <span style={{ color: '#cc0000' }}>Payment failed — please update your card</span>
              : pendingCancel
              ? <span style={{ color: '#b84800' }}>Canceling — access until {formatPlanDate(periodEnd)}</span>
              : status === 'active' || status === 'trialing'
              ? 'Active'
              : (status || 'Unknown')}
          </div>
          {periodEnd && !pendingCancel && status !== 'past_due' && (
            <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '14px' }}>
              {billing === 'two_year_prepay' ? <><strong>Access until:</strong> {formatPlanDate(periodEnd)}</> : <><strong>Renews on:</strong> {formatPlanDate(periodEnd)}</>}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={openPortal}
              disabled={busy !== null}
              style={{ background: '#1d1d1f', color: 'white', border: 'none', borderRadius: '9px', padding: '10px 18px', fontSize: '13px', fontWeight: '700', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: busy ? 0.6 : 1 }}
            >
              {busy === 'portal' ? 'Loading…' : 'Manage billing →'}
            </button>
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
              <div style={{ fontSize: '12px', color: '#6e6e73', lineHeight: '1.5', marginBottom: '10px' }}>
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