'use client'

// The open-house map: every open house in the system, color-coded pins —
// blue = upcoming, green = happening now, gray = past — with clickable
// legend chips to show/hide each group. Clicking a pin shows times, the
// listing link, and the agent's contact info.
//
// Two modes:
//   - Admin Map tab (default): fetches with the admin's session token and
//     offers a "View agent in admin" button (via onViewAgent) plus the
//     copyable share link when MAP_SHARE_CODE is configured.
//   - Secret-link share page: pass shareCode; fetches the public-by-code
//     endpoint, no login, no admin-only buttons.
//
// This component owns the Maps JS <Script> tag (it was global in
// app/layout.tsx until 2026-07-23, costing ~200KB on every page) — the
// admin Map tab and /map/[code] are the only Maps JS consumers, so it
// loads here and the effect below polls window.google until it's ready.

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import { escapeHtml } from '@/lib/escape-html'
import { googleCalendarUrl } from '@/lib/register-helpers'
import { inWeekend, pastHiddenByDefault } from '@/lib/map-filters'

type PinStatus = 'past' | 'current' | 'future'
type Pin = {
  id: string
  address: string
  date: string
  hours: string
  startAt: string | null
  endAt: string | null
  listingUrl: string | null
  price: string | null
  beds: string | null
  baths: string | null
  status: PinStatus
  lat: number
  lng: number
  agent: { id: string; name: string; phone: string; email: string }
}

const SUB = '#6e6e73'
const BORDER = '#e5e5ea'

const STATUS_META: Record<PinStatus, { label: string; color: string }> = {
  current: { label: 'Happening now', color: '#1f9d55' },
  future: { label: 'Upcoming', color: '#0071e3' },
  past: { label: 'Past', color: '#9e9ea4' },
}

// Classic map-pin shape as an inline SVG data URI, tinted per status. Past
// pins render slightly smaller/dimmer so live and upcoming ones pop.
function pinIcon(status: PinStatus): { url: string; scaledSize: unknown } {
  const { color } = STATUS_META[status]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34"><path fill="${color}" stroke="white" stroke-width="1" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"/><circle cx="12" cy="9" r="2.6" fill="white"/></svg>`
  const size = status === 'past' ? 26 : 34
  const g = (window as any).google
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new g.maps.Size(size, size),
  }
}

// Cluster bubbles inherit their group's pin color so the green/blue/gray
// legend still reads at a glance when nearby pins collapse into one circle.
function clusterRenderer(status: PinStatus) {
  return {
    render: ({ count, position }: { count: number; position: unknown }) => {
      const { color } = STATUS_META[status]
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44"><circle cx="22" cy="22" r="20" fill="${color}" fill-opacity="0.85" stroke="white" stroke-width="2"/></svg>`
      const g = (window as any).google
      return new g.maps.Marker({
        position,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
          scaledSize: new g.maps.Size(44, 44),
        },
        label: { text: String(count), color: 'white', fontWeight: '700', fontSize: '13px' },
        zIndex: status === 'past' ? 1 : status === 'future' ? 2 : 3,
      })
    },
  }
}

// Crosshair "my location" glyph for the custom map control, tinted by state.
function targetSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="${color}"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>`
}

// Adds a Google-Maps-style "zoom to my location" button to the map. On tap it
// asks the browser for the viewer's position, drops/updates a blue dot there,
// and zooms in. onError surfaces a human message above the map.
function addLocateControl(g: any, map: any, onError: (msg: string) => void) {
  if (!('geolocation' in navigator)) return
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.title = 'Zoom to your location'
  btn.setAttribute('aria-label', 'Zoom to your location')
  btn.innerHTML = targetSvg('#666')
  Object.assign(btn.style, {
    background: 'white',
    border: 'none',
    borderRadius: '2px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
    cursor: 'pointer',
    width: '40px',
    height: '40px',
    margin: '10px',
    padding: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  })
  let meMarker: any = null
  btn.addEventListener('click', () => {
    btn.style.opacity = '0.5'
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        btn.style.opacity = '1'
        btn.innerHTML = targetSvg('#0071e3')
        onError('')
        const position = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        // Blue "you are here" dot, styled after Google's own location marker.
        if (!meMarker) {
          const dot = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="10" fill="#4285F4" opacity="0.25"/><circle cx="12" cy="12" r="6" fill="#4285F4" stroke="white" stroke-width="2"/></svg>`
          meMarker = new g.maps.Marker({
            map,
            position,
            title: 'Your location',
            clickable: false,
            zIndex: 4,
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(dot)}`,
              scaledSize: new g.maps.Size(22, 22),
              anchor: new g.maps.Point(11, 11),
            },
          })
        } else {
          meMarker.setPosition(position)
        }
        map.panTo(position)
        map.setZoom(11)
      },
      (err) => {
        btn.style.opacity = '1'
        onError(
          err.code === err.PERMISSION_DENIED
            ? 'Location is blocked — allow location access in your browser to use the locate button.'
            : "Couldn't get your location — please try again."
        )
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    )
  })
  map.controls[g.maps.ControlPosition.RIGHT_BOTTOM].push(btn)
}

function infoWindowHtml(pin: Pin, withAgentButton: boolean): string {
  const e = escapeHtml
  const status = STATUS_META[pin.status]
  const phoneDigits = pin.agent.phone.replace(/[^\d+]/g, '')
  // The calendar icon links to a prefilled Google Calendar event when the
  // open house has structured times (legacy rows without them keep the
  // plain icon).
  const calIcon = pin.startAt
    ? `<a href="${e(googleCalendarUrl(`Open House — ${pin.address}`.trim(), pin.startAt, pin.endAt || pin.startAt, pin.address))}" target="_blank" rel="noopener" title="Add to Google Calendar" style="text-decoration: none;">📅</a>`
    : '📅'
  // Same fact line the visitor email's upcoming-open-houses section uses.
  const facts = [
    pin.price ? `💰 ${e(pin.price)}` : '',
    pin.beds ? `🛏 ${e(pin.beds)} bed` : '',
    pin.baths ? `🛁 ${e(pin.baths)} bath` : '',
  ].filter(Boolean).join(' · ')
  return `
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-size: 13px; line-height: 1.7; max-width: 260px; color: #1d1d1f;">
      <div style="display: inline-block; font-size: 11px; font-weight: 700; color: white; background: ${status.color}; border-radius: 999px; padding: 1px 9px; margin-bottom: 4px;">${status.label}</div>
      <div style="font-weight: 700;">${e(pin.address)}</div>
      <div style="color: ${SUB};">${calIcon} ${e(pin.date)}<br/>🕒 ${e(pin.hours)}</div>
      ${facts ? `<div style="color: ${SUB};">${facts}</div>` : ''}
      ${pin.listingUrl ? `<div><a href="${e(pin.listingUrl)}" target="_blank" rel="noopener" style="color: #0071e3;">View listing →</a></div>` : ''}
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid ${BORDER};">
        <div style="font-weight: 700;">${e(pin.agent.name)}</div>
        ${pin.agent.phone ? `<div><a href="tel:${e(phoneDigits)}" style="color: #0071e3; text-decoration: none;">${e(pin.agent.phone)}</a></div>` : ''}
        ${pin.agent.email ? `<div><a href="mailto:${e(pin.agent.email)}" style="color: #0071e3; text-decoration: none;">${e(pin.agent.email)}</a></div>` : ''}
        ${withAgentButton ? `<button data-view-agent style="margin-top: 6px; font-size: 12px; font-weight: 600; color: #1d1d1f; background: #f5f5f7; border: 1px solid #d1d1d6; border-radius: 8px; padding: 6px 10px; cursor: pointer; font-family: inherit;">View agent in admin →</button>` : ''}
      </div>
    </div>`
}

export default function OpenHouseMap({
  shareCode,
  onViewAgent,
}: {
  shareCode?: string
  onViewAgent?: (agent: { id: string; name: string; phone: string; email: string }) => void
}) {
  const mapDiv = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('Loading map…')
  const [unmapped, setUnmapped] = useState<string[]>([])
  const [counts, setCounts] = useState<Record<PinStatus, number> | null>(null)
  const [visible, setVisible] = useState<Record<PinStatus, boolean>>({ current: true, future: true, past: true })
  const [share, setShare] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState('')
  const [weekendOnly, setWeekendOnly] = useState(false)
  // Markers grouped by status; each status group renders through its own
  // clusterer (so nearby pins collapse into a colored count bubble), and the
  // legend chips / weekend filter work by re-feeding each clusterer its
  // currently-eligible markers.
  const markersRef = useRef<Record<PinStatus, any[]>>({ current: [], future: [], past: [] })
  const clusterersRef = useRef<Record<PinStatus, MarkerClusterer | null>>({ current: null, future: null, past: null })
  const visibleRef = useRef<Record<PinStatus, boolean>>({ current: true, future: true, past: true })
  const weekendOnlyRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const mapRef = useRef<any>(null)
  // The tab-switch callback changes identity between renders; keep the latest
  // in a ref so marker listeners registered once always call the current one.
  const viewAgentRef = useRef(onViewAgent)
  viewAgentRef.current = onViewAgent

  // Re-syncs every clusterer with the markers that pass the current filters:
  // status chip on/off × weekend-only. Reads refs (not state) so it can run
  // from inside the one-time map-setup effect and from chip handlers alike.
  const applyFilters = () => {
    for (const s of ['current', 'future', 'past'] as PinStatus[]) {
      const clusterer = clusterersRef.current[s]
      if (!clusterer) continue
      clusterer.clearMarkers()
      if (!visibleRef.current[s]) continue
      const members = weekendOnlyRef.current
        ? markersRef.current[s].filter((m) => m.__weekend)
        : markersRef.current[s]
      if (members.length > 0) clusterer.addMarkers(members)
    }
  }

  const toggleStatus = (s: PinStatus) => {
    visibleRef.current = { ...visibleRef.current, [s]: !visibleRef.current[s] }
    setVisible(visibleRef.current)
    applyFilters()
  }

  const toggleWeekend = () => {
    weekendOnlyRef.current = !weekendOnlyRef.current
    setWeekendOnly(weekendOnlyRef.current)
    applyFilters()
  }

  // City/zip jump: geocode whatever's typed and fly the map there. Uses the
  // core Maps JS Geocoder (already loaded) rather than a Places autocomplete
  // widget, so it works on any key and adds no extra library.
  const jumpTo = () => {
    const query = searchRef.current?.value.trim()
    if (!query || !mapRef.current) return
    const g = (window as any).google
    new g.maps.Geocoder().geocode({ address: query, region: 'us' }, (results: any, gstatus: string) => {
      const geom = gstatus === 'OK' ? results?.[0]?.geometry : null
      if (!geom) {
        setNotice(`Couldn't find “${query}” — try a city name or zip code.`)
        return
      }
      setNotice('')
      if (geom.viewport) mapRef.current.fitBounds(geom.viewport)
      else {
        mapRef.current.setCenter(geom.location)
        mapRef.current.setZoom(12)
      }
    })
  }

  const copyShare = async () => {
    if (!share) return
    try {
      await navigator.clipboard.writeText(share)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable — the link is still selectable */ }
  }

  useEffect(() => {
    let cancelled = false

    const waitForGoogle = () =>
      new Promise<void>((resolve, reject) => {
        const started = Date.now()
        const poll = () => {
          if ((window as any).google?.maps) return resolve()
          if (Date.now() - started > 10000) return reject(new Error('Google Maps failed to load'))
          setTimeout(poll, 200)
        }
        poll()
      })

    const run = async () => {
      let res: Response
      if (shareCode) {
        res = await fetch(`/api/map/${encodeURIComponent(shareCode)}`)
        if (res.status === 404) throw new Error('This map link is not valid.')
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { window.location.href = '/login'; return }
        res = await fetch('/api/admin/map', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
      }
      if (!res.ok) throw new Error('Could not load open houses')
      const { pins, unmapped: missed, shareUrl }: { pins: Pin[]; unmapped: string[]; shareUrl?: string | null } = await res.json()

      await waitForGoogle()
      if (cancelled || !mapDiv.current) return

      const g = (window as any).google
      const map = new g.maps.Map(mapDiv.current, {
        // Geographic center of the contiguous US — the fallback view when
        // there are no pins to fit bounds around.
        center: { lat: 39.83, lng: -98.58 },
        zoom: 4,
        mapTypeControl: false,
        streetViewControl: false,
        zoomControl: true,
        fullscreenControl: true,
      })
      mapRef.current = map
      addLocateControl(g, map, setNotice)
      const info = new g.maps.InfoWindow()

      const bounds = new g.maps.LatLngBounds()
      const weekendNow = new Date()
      for (const pin of pins) {
        // Clusterers own map attachment, so markers are created detached.
        const marker = new g.maps.Marker({
          position: { lat: pin.lat, lng: pin.lng },
          title: pin.address,
          icon: pinIcon(pin.status),
          zIndex: pin.status === 'past' ? 1 : pin.status === 'future' ? 2 : 3,
        })
        marker.__weekend = inWeekend(pin.startAt, pin.endAt, weekendNow)
        bounds.extend(marker.getPosition())
        markersRef.current[pin.status].push(marker)
        marker.addListener('click', () => {
          const holder = document.createElement('div')
          holder.innerHTML = infoWindowHtml(pin, !!viewAgentRef.current)
          holder.querySelector('[data-view-agent]')?.addEventListener('click', () => {
            info.close()
            viewAgentRef.current?.(pin.agent)
          })
          info.setContent(holder)
          info.open({ map, anchor: marker })
        })
      }

      // Past first so live/upcoming clusters draw on top where groups overlap.
      for (const s of ['past', 'future', 'current'] as PinStatus[]) {
        clusterersRef.current[s] = new MarkerClusterer({ map, markers: [], renderer: clusterRenderer(s) })
      }

      const tallies = {
        current: pins.filter((p) => p.status === 'current').length,
        future: pins.filter((p) => p.status === 'future').length,
        past: pins.filter((p) => p.status === 'past').length,
      }
      visibleRef.current = {
        current: true,
        future: true,
        past: !pastHiddenByDefault(tallies.current, tallies.future, tallies.past),
      }
      setVisible(visibleRef.current)
      applyFilters()

      if (pins.length > 1) {
        map.fitBounds(bounds, 60)
      } else if (pins.length === 1) {
        map.setCenter(bounds.getCenter())
        map.setZoom(13)
      }

      setCounts(tallies)
      setUnmapped(missed)
      setShare(shareUrl || null)
      setMessage(pins.length === 0 ? 'No open houses to map yet.' : '')
      setStatus('ready')
    }

    run().catch((err) => {
      if (cancelled) return
      setMessage(err?.message || 'Something went wrong loading the map.')
      setStatus('error')
    })

    return () => { cancelled = true }
  }, [shareCode])

  return (
    <div style={{ marginTop: 18 }}>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&v=weekly&libraries=places`}
        strategy="afterInteractive"
      />
      {status !== 'ready' && (
        <div style={{ padding: '14px 0', fontSize: 14, color: status === 'error' ? '#cc0000' : SUB }}>{message}</div>
      )}
      {status === 'ready' && message && (
        <div style={{ padding: '14px 0', fontSize: 14, color: SUB }}>{message}</div>
      )}
      {notice && (
        <div style={{ padding: '0 0 10px', fontSize: 13, color: '#cc0000' }}>{notice}</div>
      )}
      {counts && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 12px' }}>
          {(['current', 'future', 'past'] as PinStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              title={visible[s] ? `Hide ${STATUS_META[s].label.toLowerCase()} pins` : `Show ${STATUS_META[s].label.toLowerCase()} pins`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                color: visible[s] ? '#1d1d1f' : '#b0b0b5',
                background: visible[s] ? '#f5f5f7' : 'white',
                border: `1px solid ${visible[s] ? '#d1d1d6' : BORDER}`,
                borderRadius: 999,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_META[s].color, display: 'inline-block', opacity: visible[s] ? 1 : 0.3 }} />
              <span style={{ textDecoration: visible[s] ? 'none' : 'line-through' }}>
                {STATUS_META[s].label} ({counts[s]})
              </span>
            </button>
          ))}
          <button
            onClick={toggleWeekend}
            title={weekendOnly ? 'Show all dates' : 'Only show open houses this Saturday & Sunday'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              color: weekendOnly ? '#0071e3' : '#1d1d1f',
              background: weekendOnly ? '#e8f1fd' : 'white',
              border: `1px solid ${weekendOnly ? '#0071e3' : '#d1d1d6'}`,
              borderRadius: 999,
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            📆 This weekend{weekendOnly ? ' ✓' : ''}
          </button>
          <input
            ref={searchRef}
            type="text"
            placeholder="Jump to city or zip"
            onKeyDown={(e) => { if (e.key === 'Enter') jumpTo() }}
            style={{
              fontSize: 13,
              fontFamily: 'inherit',
              color: '#1d1d1f',
              background: 'white',
              border: '1px solid #d1d1d6',
              borderRadius: 999,
              padding: '6px 12px',
              width: 150,
            }}
          />
          <button
            onClick={jumpTo}
            title="Jump to this city or zip"
            aria-label="Search the map"
            style={{
              fontSize: 13,
              fontFamily: 'inherit',
              background: 'white',
              border: '1px solid #d1d1d6',
              borderRadius: 999,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            🔍
          </button>
          {share && (
            <button
              onClick={copyShare}
              title={share}
              style={{
                marginLeft: 'auto',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                color: '#0071e3',
                background: 'white',
                border: `1px solid #d1d1d6`,
                borderRadius: 999,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              {copied ? 'Link copied ✓' : 'Copy shareable link'}
            </button>
          )}
        </div>
      )}
      <div
        ref={mapDiv}
        style={{
          width: '100%',
          height: 600,
          borderRadius: 12,
          border: `1px solid ${BORDER}`,
          // Keep layout stable before tiles arrive.
          background: '#f5f5f7',
        }}
      />
      {unmapped.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: SUB }}>
          Couldn&apos;t place {unmapped.length} address{unmapped.length === 1 ? '' : 'es'} on the map: {unmapped.join(' · ')}
        </div>
      )}
    </div>
  )
}
