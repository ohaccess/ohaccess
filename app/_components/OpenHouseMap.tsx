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
// The Maps JS script is already loaded globally in app/layout.tsx, so this
// only waits for it.

import { useEffect, useRef, useState } from 'react'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import { escapeHtml } from '@/lib/escape-html'
import { googleCalendarUrl } from '@/lib/register-helpers'

type PinStatus = 'past' | 'current' | 'future'
type Pin = {
  id: string
  address: string
  date: string
  hours: string
  startAt: string | null
  endAt: string | null
  listingUrl: string | null
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
  return `
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-size: 13px; line-height: 1.7; max-width: 260px; color: #1d1d1f;">
      <div style="display: inline-block; font-size: 11px; font-weight: 700; color: white; background: ${status.color}; border-radius: 999px; padding: 1px 9px; margin-bottom: 4px;">${status.label}</div>
      <div style="font-weight: 700;">${e(pin.address)}</div>
      <div style="color: ${SUB};">${calIcon} ${e(pin.date)}<br/>🕒 ${e(pin.hours)}</div>
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
  // Markers grouped by status so the legend chips can show/hide them, and the
  // map instance so toggled-on markers re-attach to it.
  const markersRef = useRef<Record<PinStatus, any[]>>({ current: [], future: [], past: [] })
  const mapRef = useRef<any>(null)
  // The tab-switch callback changes identity between renders; keep the latest
  // in a ref so marker listeners registered once always call the current one.
  const viewAgentRef = useRef(onViewAgent)
  viewAgentRef.current = onViewAgent

  const toggleStatus = (s: PinStatus) => {
    setVisible((v) => {
      const next = { ...v, [s]: !v[s] }
      for (const m of markersRef.current[s]) m.setMap(next[s] ? mapRef.current : null)
      return next
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
      const info = new g.maps.InfoWindow()

      const bounds = new g.maps.LatLngBounds()
      // Past pins first so live/upcoming markers draw on top of them.
      const drawOrder = [...pins].sort((a, b) => (a.status === 'past' ? -1 : 1) - (b.status === 'past' ? -1 : 1))
      for (const pin of drawOrder) {
        const marker = new g.maps.Marker({
          map,
          position: { lat: pin.lat, lng: pin.lng },
          title: pin.address,
          icon: pinIcon(pin.status),
          zIndex: pin.status === 'past' ? 1 : pin.status === 'future' ? 2 : 3,
        })
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

      if (pins.length > 1) {
        map.fitBounds(bounds, 60)
      } else if (pins.length === 1) {
        map.setCenter(bounds.getCenter())
        map.setZoom(13)
      }

      setCounts({
        current: pins.filter((p) => p.status === 'current').length,
        future: pins.filter((p) => p.status === 'future').length,
        past: pins.filter((p) => p.status === 'past').length,
      })
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
      {status !== 'ready' && (
        <div style={{ padding: '14px 0', fontSize: 14, color: status === 'error' ? '#cc0000' : SUB }}>{message}</div>
      )}
      {status === 'ready' && message && (
        <div style={{ padding: '14px 0', fontSize: 14, color: SUB }}>{message}</div>
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
