'use client'
import type { CSSProperties } from 'react'

// The New / Edit Open House form: property details (with Google address
// autocomplete + a date-picker calendar) and the two access code words.
// Presentational — form state, the address/code-word helpers, and the
// create/update handlers all live in page.tsx and are passed in as props.

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa']

export default function NewOpenHouseForm({
  editingOH,
  locked,
  form,
  setForm,
  showCal,
  setShowCal,
  calDate,
  setCalDate,
  addressSuggestions,
  showSuggestions,
  setShowSuggestions,
  getAddressSuggestions,
  selectAddress,
  generateSmsWord,
  generateEmailWord,
  createOpenHouse,
  updateOpenHouse,
  resetForm,
  setView,
  setEditingOH,
  primaryColor,
  onPrimary,
  primaryBtnBorder,
  inputStyle,
  labelStyle,
}: {
  editingOH: any
  locked: boolean
  form: any
  setForm: (f: any) => void
  showCal: boolean
  setShowCal: (v: boolean) => void
  calDate: Date
  setCalDate: (d: Date) => void
  addressSuggestions: any[]
  showSuggestions: boolean
  setShowSuggestions: (v: boolean) => void
  getAddressSuggestions: (input: string) => void
  selectAddress: (placeId: string) => void
  generateSmsWord: () => string
  generateEmailWord: () => string
  createOpenHouse: () => void
  updateOpenHouse: () => void
  resetForm: () => void
  setView: (v: 'dashboard' | 'new' | 'settings' | 'team' | 'activity') => void
  setEditingOH: (oh: any) => void
  primaryColor: string
  onPrimary: string
  primaryBtnBorder: string
  inputStyle: CSSProperties
  labelStyle: CSSProperties
}) {
  const firstDay = new Date(calDate.getFullYear(), calDate.getMonth(), 1).getDay()
  const daysInMonth = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0).getDate()

  return (
    <>
      <div style={{ fontSize: '24px', fontWeight: '600', color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '3px' }}>{editingOH ? 'Edit open house' : 'New open house'}</div>
      <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '24px' }}>{editingOH ? 'Update your listing details.' : 'Set up your listing and generate your QR code.'}</div>

      <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f' }}>Property Details</span>
          <span style={{ fontSize: '11px', color: '#6e6e73' }}><span style={{ color: '#ff3b30' }}>*</span> required field</span>
        </div>
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
            <input style={inputStyle} type="text" placeholder="2,450" value={form.square_footage} onChange={e => setForm({ ...form, square_footage: e.target.value })} />
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
            <label style={labelStyle}>Open House Date <span style={{ color: '#ff3b30' }}>*</span></label>
            <input style={{ ...inputStyle, cursor: 'pointer' }} type="text" placeholder="Select a date" value={form.open_house_date} readOnly onClick={() => setShowCal(!showCal)} />
            {showCal && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100, background: 'white', border: '1px solid #d1d1d6', borderRadius: '18px', padding: '14px', width: '242px', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <button onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth()-1, 1))} style={{ background: primaryColor, color: onPrimary, border: primaryBtnBorder, borderRadius: '7px', padding: '4px 10px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>‹</button>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f' }}>{MONTHS[calDate.getMonth()]} {calDate.getFullYear()}</span>
                  <button onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth()+1, 1))} style={{ background: primaryColor, color: onPrimary, border: primaryBtnBorder, borderRadius: '7px', padding: '4px 10px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>›</button>
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
            <label style={labelStyle}>Open House Hours <span style={{ color: '#ff3b30' }}>*</span></label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input style={inputStyle} type="time" value={form.open_house_start_time} onChange={e => setForm({ ...form, open_house_start_time: e.target.value })} />
              <span style={{ color: '#6e6e73', fontSize: '13px' }}>to</span>
              <input style={inputStyle} type="time" value={form.open_house_end_time} onChange={e => setForm({ ...form, open_house_end_time: e.target.value })} />
            </div>
            <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '4px' }}>We&apos;ll email you a visitor report about 30 minutes after it ends.</div>
          </div>
          <div>
            <label style={labelStyle}>Listing URL (your site, Zill*w, H*mes.com, etc.)</label>
            <input style={inputStyle} type="url" placeholder="https://yourbrokerage.com/listing" value={form.listing_url} onChange={e => setForm({ ...form, listing_url: e.target.value })} />
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '20px 22px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px', paddingBottom: '12px', borderBottom: '1px solid #d1d1d6' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f' }}>Access Code Words</span>
          <span style={{ fontSize: '11px', color: '#6e6e73' }}><span style={{ color: '#ff3b30' }}>*</span> required field</span>
        </div>
        <div style={{ fontSize: '13px', color: '#6e6e73', margin: '12px 0 16px', lineHeight: '1.5' }}>
          Each visitor gets two codes — one by text, one by email. At the door, ask for the <strong>text code</strong> first (a real phone is hard to fake); accept the email code only if their text didn&apos;t arrive.
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
          {/* Text (SMS) code — primary */}
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <label style={labelStyle}>📱 Text code (SMS) — primary <span style={{ color: '#ff3b30' }}>*</span></label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input style={{ ...inputStyle, fontWeight: '700', letterSpacing: '2px', fontSize: '15px' }} type="text" placeholder="e.g. LOVELY" value={form.code_word} onChange={e => setForm({ ...form, code_word: e.target.value.toUpperCase() })} />
              </div>
              <button onClick={() => setForm({ ...form, code_word: generateSmsWord() })} style={{ padding: '9px 14px', background: primaryColor, color: onPrimary, border: primaryBtnBorder, borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
                ✦ Auto-generate
              </button>
            </div>
          </div>

          {/* Email code — fallback */}
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <label style={labelStyle}>✉️ Email code — fallback <span style={{ color: '#ff3b30' }}>*</span></label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input style={{ ...inputStyle, fontWeight: '700', letterSpacing: '2px', fontSize: '15px' }} type="text" placeholder="e.g. TUDOR" value={form.code_word_email} onChange={e => setForm({ ...form, code_word_email: e.target.value.toUpperCase() })} />
              </div>
              <button onClick={() => setForm({ ...form, code_word_email: generateEmailWord() })} style={{ padding: '9px 14px', background: primaryColor, color: onPrimary, border: primaryBtnBorder, borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
                ✦ Auto-generate
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={() => { setView('dashboard'); setEditingOH(null); resetForm() }} style={{ padding: '9px 18px', background: '#e8e8ed', color: '#1d1d1f', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cancel</button>
        <button disabled={locked} onClick={editingOH ? updateOpenHouse : createOpenHouse} style={{ padding: '9px 18px', background: primaryColor, color: onPrimary, border: primaryBtnBorder, borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {editingOH ? '✓ Update open house' : '✓ Save open house'}
        </button>
      </div>
    </>
  )
}
