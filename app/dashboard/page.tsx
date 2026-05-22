'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

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
  const [view, setView] = useState<'dashboard' | 'new' | 'settings'>('dashboard')
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
    open_house_hours: '',
    listing_url: '',
    code_word: ''
  })

  const primaryColor = profile?.primary_color || '#1d1d1f'
  const accentColor = profile?.accent_color || '#0071e3'

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa']

  useEffect(() => { checkUser() }, [])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const { data: refreshData } = await supabase.auth.refreshSession()
      if (!refreshData.session) { window.location.href = '/login'; return }
      setUser(refreshData.session.user)
      await loadProfile(refreshData.session.user.id)
      await loadOpenHouses(refreshData.session.user.id)
      setLoading(false)
      return
    }
    setUser(session.user)
    await loadProfile(session.user.id)
    await loadOpenHouses(session.user.id)
    setLoading(false)
  }

  const loadProfile = async (userId: string) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (data) {
        setProfile(data)
      } else {
        // Auto-create profile if it doesn't exist
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({ id: userId, email: (await supabase.auth.getUser()).data.user?.email })
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

  const generateCodeWord = () => {
    const words = ['KEYSTONE','MERIDIAN','HAVEN','OAKWOOD','SOLSTICE','STERLING','REFLECT','AURORA','HORIZON','CYPRESS','EXPLORE','WILLOW','SUMMIT','HARBOR','CRESTVIEW']
    return words[Math.floor(Math.random() * words.length)]
  }

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
    square_footage: '', open_house_date: '',
    open_house_hours: '', listing_url: '', code_word: ''
  })

  const getAddressSuggestions = async (value: string) => {
    if (value.length < 3) { setShowSuggestions(false); return }
    try {
      const res = await fetch(`/api/places?input=${encodeURIComponent(value)}`)
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
      const res = await fetch(`/api/places?placeId=${placeId}`)
      const data = await res.json()
      if (data.street) {
        setForm(prev => ({
          ...prev,
          street_address: data.street,
          city: data.city,
          state: data.state,
          zip_code: data.zip
        }))
      }
      setShowSuggestions(false)
      setAddressSuggestions([])
    } catch {
      setShowSuggestions(false)
    }
  }

  const createOpenHouse = async () => {
    if (!form.street_address || !form.city || !form.state || !form.code_word) {
      alert('Please fill in the street address, city, state, and code word.')
      return
    }
    const tier = profile?.tier || 'free'
    const isPaidTier = ['pro', 'team', 'brokerage'].includes(tier)
    if (!isPaidTier) {
      const { count } = await supabase
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id)
      if ((count || 0) >= 50) {
        alert('You have used all 50 of your free trial visitor registrations. Please upgrade to Pro to continue.')
        return
      }
    }
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
      open_house_hours: form.open_house_hours,
      listing_url: form.listing_url,
      code_word: form.code_word,
      status: 'active'
    }).select()
    if (error) { alert('Error saving: ' + error.message); return }
    if (data) { await loadOpenHouses(user.id); setView('dashboard'); resetForm() }
  }

  const startEdit = (oh: any) => {
    setEditingOH(oh)
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
      open_house_hours: oh.open_house_hours || '',
      listing_url: oh.listing_url || '',
      code_word: oh.code_word || ''
    })
    setView('new')
  }

  const updateOpenHouse = async () => {
    if (!form.street_address || !form.city || !form.state || !form.code_word) {
      alert('Please fill in the street address, city, state, and code word.')
      return
    }
    const fullAddress = `${form.street_address}${form.address_2 ? ' ' + form.address_2 : ''}, ${form.city}, ${form.state}${form.zip_code ? ' ' + form.zip_code : ''}`
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
      open_house_hours: form.open_house_hours,
      listing_url: form.listing_url,
      code_word: form.code_word,
    }).eq('id', editingOH.id)
    if (error) { alert('Error updating: ' + error.message); return }
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
    await supabase.from('visitors').update({ verified: !current }).eq('id', visitorId)
    setVisitors(visitors.map(v => v.id === visitorId ? { ...v, verified: !current } : v))
  }

  const exportCSV = () => {
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
    if (error) { alert('Error saving: ' + error.message); return }
    setSavedSettings(true)
    setTimeout(() => setSavedSettings(false), 3000)
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
          {(['dashboard', 'new', 'settings'] as const).map(v => (
            <button key={v} onClick={() => { setView(v); if (v !== 'new') setEditingOH(null) }} style={{ background: view === v ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', color: view === v ? 'white' : 'rgba(255,255,255,0.6)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: view === v ? '600' : '400' }}>
              {v === 'dashboard' ? 'Dashboard' : v === 'new' ? 'New Open House' : 'Settings'}
            </button>
          ))}
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
          {(['dashboard', 'new', 'settings'] as const).map(v => (
            <button key={v} onClick={() => { setView(v); if (v !== 'new') setEditingOH(null); setMobileMenuOpen(false) }}
              style={{ background: view === v ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', color: 'white', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px', fontWeight: view === v ? '600' : '400', textAlign: 'left' as const }}>
              {v === 'dashboard' ? '📊 Dashboard' : v === 'new' ? '＋ New Open House' : '⚙️ Settings'}
            </button>
          ))}
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
      `}</style>

      <div style={{ padding: '28px' }}>

        {/* DASHBOARD VIEW */}
        {view === 'dashboard' && (
          <>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>Dashboard</div>
            <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '16px' }}>Real-time visitor log and open house management.</div>

            {!['pro','team','brokerage'].includes(profile?.tier || 'free') && (
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
              <button onClick={() => { setEditingOH(null); resetForm(); setView('new') }} style={{ background: accentColor, color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
                        <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '2px' }}>{oh.open_house_date} · {oh.open_house_hours} · Code: <strong>{oh.code_word}</strong></div>
                      </div>
                      {oh.status === 'active' && (
                        <div style={{ background: '#e8f9ee', color: '#1a7a3c', fontSize: '11px', fontWeight: '600', padding: '3px 9px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#30d158' }} />Live
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      <button onClick={async (e) => {
                        e.stopPropagation()
                        const url = `${window.location.origin}/register/${oh.id}`
                        const res = await fetch(`/api/qrcode?url=${encodeURIComponent(url)}`)
                        const blob = await res.blob()
                        const dataUrl = await new Promise<string>(resolve => {
                          const reader = new FileReader()
                          reader.onload = () => resolve(reader.result as string)
                          reader.readAsDataURL(blob)
                        })
                        setQrModal({ oh, url, dataUrl, blob })
                      }} style={{ background: accentColor, color: 'white', border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>📱 QR Code</button>
                      <button onClick={(e) => {
                        e.stopPropagation()
                        const url = `${window.location.origin}/register/${oh.id}`
                        navigator.clipboard.writeText(url)
                        alert('Registration URL copied!')
                      }} style={{ background: primaryColor, color: 'white', border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>📋 Copy URL</button>
                      <button onClick={(e) => { e.stopPropagation(); startEdit(oh) }} style={{ background: '#f5f5f7', color: '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '6px', padding: '5px 8px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>✏️ Edit</button>
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
                  <button onClick={exportCSV} style={{ background: primaryColor, color: 'white', border: 'none', padding: '6px 13px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Export CSV</button>
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
                              <button onClick={() => toggleVerified(v.id, v.verified)} style={{ background: v.verified ? '#30d158' : primaryColor, color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
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
                            <div key={day} onClick={() => { const d = new Date(calDate.getFullYear(), calDate.getMonth(), day); setForm({ ...form, open_house_date: `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${day}, ${d.getFullYear()}` }); setShowCal(false) }}
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
                  <input style={inputStyle} type="text" placeholder="1:00 PM – 4:00 PM" value={form.open_house_hours} onChange={e => setForm({ ...form, open_house_hours: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Listing URL (your site, Zillow, Realtor)</label>
                  <input style={inputStyle} type="url" placeholder="https://yourbrokerage.com/listing" value={form.listing_url} onChange={e => setForm({ ...form, listing_url: e.target.value })} />
                </div>
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Access code word</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Code Word</label>
                  <input style={{ ...inputStyle, fontWeight: '700', letterSpacing: '2px', fontSize: '15px' }} type="text" placeholder="e.g. KEYSTONE" value={form.code_word} onChange={e => setForm({ ...form, code_word: e.target.value.toUpperCase() })} />
                </div>
                <button onClick={() => setForm({ ...form, code_word: generateCodeWord() })} style={{ padding: '9px 14px', background: primaryColor, color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
                  ✦ Auto-generate
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => { setView('dashboard'); setEditingOH(null); resetForm() }} style={{ padding: '9px 18px', background: '#e8e8ed', color: '#1d1d1f', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
              <button onClick={editingOH ? updateOpenHouse : createOpenHouse} style={{ padding: '9px 18px', background: primaryColor, color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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

            <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Agent profile</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input style={inputStyle} type="text" placeholder="Sarah Connelly" value={profile?.full_name || ''} onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Brokerage</label>
                  <input style={inputStyle} type="text" placeholder="Premier Realty Group" value={profile?.brokerage || ''} onChange={e => setProfile({ ...profile, brokerage: e.target.value })} />
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
                </div>
              </div>
            </div>

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

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
              {savedSettings && <span style={{ fontSize: '13px', color: '#30d158', fontWeight: '600' }}>✓ Settings saved!</span>}
              <button onClick={saveSettings} style={{ padding: '9px 18px', background: primaryColor, color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                ✓ Save settings
              </button>
            </div>
          </>
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
                alert('Registration URL copied!')
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

              <button onClick={() => setQrModal(null)} style={{ background: 'none', border: 'none', color: '#aeaeb2', fontSize: '13px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '4px' }}>
                Close
              </button>
            </div>
          </div>
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
      <a href="/#pricing" style={{
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