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
  const [form, setForm] = useState({
    property_address: '',
    listing_price: '',
    bedrooms: '',
    bathrooms: '',
    square_footage: '',
    description: '',
    open_house_date: '',
    open_house_hours: '',
    code_word: ''
  })

  const primaryColor = profile?.primary_color || '#1d1d1f'
  const accentColor = profile?.accent_color || '#0071e3'

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa']

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const { data: refreshData } = await supabase.auth.refreshSession()
      if (!refreshData.session) {
        window.location.href = '/login'
        return
      }
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
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) setProfile(data)
  }

  const loadOpenHouses = async (userId: string) => {
    const { data } = await supabase
      .from('open_houses')
      .select('*')
      .eq('agent_id', userId)
      .order('created_at', { ascending: false })
    if (data) {
      setOpenHouses(data)
      if (data.length > 0) {
        setSelectedOH(data[0])
        await loadVisitors(data[0].id)
      }
    }
  }

  const loadVisitors = async (openHouseId: string) => {
    const { data } = await supabase
      .from('visitors')
      .select('*')
      .eq('open_house_id', openHouseId)
      .order('registered_at', { ascending: false })
    if (data) setVisitors(data)
  }

  const generateCodeWord = () => {
    const words = ['KEYSTONE','MERIDIAN','HAVEN','OAKWOOD','SOLSTICE','STERLING','COMPASS','AURORA','HORIZON','CYPRESS','MAGNOLIA','WILLOW','SUMMIT','HARBOR','CRESTVIEW']
    return words[Math.floor(Math.random() * words.length)]
  }

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').substring(0, 10)
    if (digits.length === 0) return ''
    if (digits.length <= 3) return `(${digits}`
    if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  }

  const createOpenHouse = async () => {
    if (!form.property_address || !form.code_word) {
      alert('Please fill in at least the property address and code word.')
      return
    }
    const { data, error } = await supabase
      .from('open_houses')
      .insert({
        agent_id: user.id,
        property_address: form.property_address,
        listing_price: form.listing_price,
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        square_footage: form.square_footage,
        description: form.description,
        open_house_date: form.open_house_date,
        open_house_hours: form.open_house_hours,
        code_word: form.code_word,
        status: 'active'
      })
      .select()
    if (error) {
      alert('Error saving: ' + error.message)
      return
    }
    if (data) {
      await loadOpenHouses(user.id)
      setView('dashboard')
      setForm({
        property_address: '', listing_price: '', bedrooms: '',
        bathrooms: '', square_footage: '', description: '',
        open_house_date: '', open_house_hours: '', code_word: ''
      })
    }
  }

  const toggleVerified = async (visitorId: string, current: boolean) => {
    await supabase.from('visitors').update({ verified: !current }).eq('id', visitorId)
    setVisitors(visitors.map(v => v.id === visitorId ? { ...v, verified: !current } : v))
  }

  const exportCSV = () => {
    const isPro = ['pro','team','brokerage'].includes(profile?.tier || 'free')
    if (!isPro) {
      alert('CSV export is available on Pro plan and above.')
      return
    }
    const headers = ['First Name','Last Name','Email','Phone','Timeline','Registered','Verified']
    const rows = visitors.map(v => [
      v.first_name, v.last_name, v.email, v.phone,
      v.purchasing_timeline,
      new Date(v.registered_at).toLocaleString(),
      v.verified ? 'Yes' : 'No'
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedOH?.property_address}-visitors.csv`
    a.click()
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
    return (
      <span style={{ background: c.bg, color: c.color, padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
        {timeline}
      </span>
    )
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#f5f5f7' }}>
      <div style={{ fontSize: '16px', color: '#6e6e73' }}>Loading your dashboard...</div>
    </div>
  )

  const inputStyle = {
    width: '100%', background: '#f5f5f7', border: '1px solid #d1d1d6',
    borderRadius: '9px', padding: '9px 12px', fontSize: '13px',
    color: '#1d1d1f', outline: 'none', boxSizing: 'border-box' as const,
    fontFamily: "'Plus Jakarta Sans', sans-serif"
  }

  const labelStyle = {
    display: 'block' as const, fontSize: '11px', fontWeight: '600' as const,
    color: '#6e6e73', textTransform: 'uppercase' as const,
    letterSpacing: '0.6px', marginBottom: '5px'
  }

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
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['dashboard', 'new', 'settings'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ background: view === v ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', color: view === v ? 'white' : 'rgba(255,255,255,0.6)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', fontWeight: view === v ? '600' : '400' }}>
              {v === 'dashboard' ? 'Dashboard' : v === 'new' ? 'New Open House' : 'Settings'}
            </button>
          ))}
          <button onClick={signOut} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ padding: '28px' }}>

        {/* DASHBOARD VIEW */}
        {view === 'dashboard' && (
          <>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>Dashboard</div>
            <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '24px' }}>Real-time visitor log and open house management.</div>

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
              <button onClick={() => setView('new')} style={{ background: accentColor, color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
                  <div key={oh.id} onClick={async () => { setSelectedOH(oh); await loadVisitors(oh.id) }} style={{ background: 'white', border: `1px solid ${selectedOH?.id === oh.id ? accentColor : '#d1d1d6'}`, borderRadius: '18px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: oh.status === 'active' ? accentColor : '#aeaeb2', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f' }}>{oh.property_address}</div>
                      <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '2px' }}>{oh.open_house_date} · {oh.open_house_hours} · Code: <strong>{oh.code_word}</strong></div>
                    </div>
                    {oh.status === 'active' && (
                      <div style={{ background: '#e8f9ee', color: '#1a7a3c', fontSize: '11px', fontWeight: '600', padding: '3px 9px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#30d158' }} />Live
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ fontSize: '11px', color: accentColor, fontWeight: '600' }}>
                      /register/{oh.id.slice(0,8)}...
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        const url = `${window.location.origin}/register/${oh.id}`
                        const res = await fetch(`/api/qrcode?url=${encodeURIComponent(url)}`)
                        const blob = await res.blob()
                        const a = document.createElement('a')
                        a.href = URL.createObjectURL(blob)
                        a.download = `ohaccess-qr-${oh.property_address.replace(/\s+/g, '-')}.png`
                        a.click()
                      }}
                      style={{ background: accentColor, color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}
                    >
                      ⬇ QR Code
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const url = `${window.location.origin}/register/${oh.id}`
                        navigator.clipboard.writeText(url)
                        alert('Registration URL copied to clipboard!')
                      }}
                      style={{ background: primaryColor, color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}
                    >
                      📋 Copy URL
                    </button>
                  </div>
                  </div>
                ))}
              </div>
            )}

            {selectedOH && (
              <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f' }}>Visitor log — {selectedOH.property_address}</div>
                  <button onClick={exportCSV} style={{ background: primaryColor, color: 'white', border: 'none', padding: '6px 13px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Export CSV
                  </button>
                </div>
                {visitors.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#6e6e73', padding: '20px', fontSize: '13px' }}>
                    No visitors yet. Share your QR code to get started!
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          {['Name','Phone','Email','Timeline','Time','Verified'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: '11px', fontWeight: '600', color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #d1d1d6' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visitors.map((v, i) => (
                          <tr key={v.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ padding: '10px', borderBottom: '1px solid #f2f2f7', color: '#6e6e73' }}>{v.first_name} {v.last_name}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #f2f2f7', color: '#6e6e73' }}>{v.phone}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #f2f2f7', color: '#6e6e73' }}>{v.email}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #f2f2f7' }}>{getTimelineBadge(v.purchasing_timeline)}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #f2f2f7', color: '#6e6e73', whiteSpace: 'nowrap' }}>{new Date(v.registered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #f2f2f7' }}>
                              <button onClick={() => toggleVerified(v.id, v.verified)} style={{ background: v.verified ? '#30d158' : primaryColor, color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                {v.verified ? '✓ Verified' : 'Mark verified'}
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

        {/* NEW OPEN HOUSE VIEW */}
        {view === 'new' && (
          <>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>New open house</div>
            <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '24px' }}>Set up your listing and generate your QR code.</div>

            <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Property details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Property Address</label>
                  <input style={inputStyle} type="text" placeholder="123 Magnolia Lane, Dallas TX" value={form.property_address} onChange={e => setForm({ ...form, property_address: e.target.value })} />
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
                  <input
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    type="text"
                    placeholder="Select a date"
                    value={form.open_house_date}
                    readOnly
                    onClick={() => setShowCal(!showCal)}
                  />
                  {showCal && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100, background: 'white', border: '1px solid #d1d1d6', borderRadius: '18px', padding: '14px', width: '242px', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <button onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth()-1, 1))} style={{ background: primaryColor, color: 'white', border: 'none', borderRadius: '7px', padding: '4px 10px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>‹</button>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f' }}>{MONTHS[calDate.getMonth()]} {calDate.getFullYear()}</span>
                        <button onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth()+1, 1))} style={{ background: primaryColor, color: 'white', border: 'none', borderRadius: '7px', padding: '4px 10px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>›</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                        {DOW.map(d => (
                          <div key={d} style={{ fontSize: '10px', fontWeight: '600', color: '#aeaeb2', textAlign: 'center', padding: '3px 0' }}>{d}</div>
                        ))}
                        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1
                          return (
                            <div
                              key={day}
                              onClick={() => {
                                const d = new Date(calDate.getFullYear(), calDate.getMonth(), day)
                                setForm({ ...form, open_house_date: `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${day}, ${d.getFullYear()}` })
                                setShowCal(false)
                              }}
                              style={{ fontSize: '12px', textAlign: 'center', padding: '5px 2px', borderRadius: '6px', cursor: 'pointer', color: '#1d1d1f' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#e8e8ed')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              {day}
                            </div>
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
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Description</label>
                  <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} placeholder="Beautiful home with..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Access code word</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Code Word</label>
                  <input style={{ ...inputStyle, fontWeight: '700', letterSpacing: '2px', fontSize: '15px' }} type="text" placeholder="e.g. MAGNOLIA" value={form.code_word} onChange={e => setForm({ ...form, code_word: e.target.value.toUpperCase() })} />
                </div>
                <button onClick={() => setForm({ ...form, code_word: generateCodeWord() })} style={{ padding: '9px 14px', background: primaryColor, color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
                  ✦ Auto-generate
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setView('dashboard')} style={{ padding: '9px 18px', background: '#e8e8ed', color: '#1d1d1f', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
              <button onClick={createOpenHouse} style={{ padding: '9px 18px', background: primaryColor, color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>✓ Save open house</button>
            </div>
          </>
        )}

        {/* SETTINGS VIEW */}
        {view === 'settings' && (
          <>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>Account settings</div>
            <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '24px' }}>Manage your profile and preferences.</div>

            <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>Agent profile</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input style={inputStyle} type="text" placeholder="David Sheehan" value={profile?.full_name || ''} onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Brokerage</label>
                  <input style={inputStyle} type="text" placeholder="Reflect Real Estate" value={profile?.brokerage || ''} onChange={e => setProfile({ ...profile, brokerage: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input
                    style={inputStyle}
                    type="tel"
                    placeholder="(214) 449-1822"
                    value={profile?.phone || ''}
                    onChange={e => setProfile({ ...profile, phone: formatPhone(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>License Number</label>
                  <input style={inputStyle} type="text" placeholder="TX-123456" value={profile?.license_number || ''} onChange={e => setProfile({ ...profile, license_number: e.target.value })} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={async () => {
                  await supabase.from('profiles').update({
                    full_name: profile?.full_name,
                    brokerage: profile?.brokerage,
                    phone: profile?.phone,
                    license_number: profile?.license_number,
                  }).eq('id', user.id)
                  alert('Settings saved!')
                }}
                style={{ padding: '9px 18px', background: primaryColor, color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                ✓ Save settings
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}