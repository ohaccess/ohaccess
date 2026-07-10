'use client'

// The admin Map tab: a Google Map of every open house in the system, with
// color-coded pins — blue = upcoming, green = happening now, gray = past.
// Clicking a pin shows times, the listing link, and the agent's contact
// info, plus a button that jumps to that agent in the Agents tab. The Maps
// JS script is already loaded globally in app/layout.tsx, so this only
// waits for it.

import { useEffect, useRef, useState } from 'react'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import { escapeHtml } from '@/lib/escape-html'

type PinStatus = 'past' | 'current' | 'future'
type Pin = {
  id: string
  address: string
  date: string
  hours: string
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

function infoWindowHtml(pin: Pin): string {
  const e = escapeHtml
  const status = STATUS_META[pin.status]
  const phoneDigits = pin.agent.phone.replace(/[^\d+]/g, '')
  return `
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-size: 13px; line-height: 1.7; max-width: 260px; color: #1d1d1f;">
      <div style="display: inline-block; font-size: 11px; font-weight: 700; color: white; background: ${status.color}; border-radius: 999px; padding: 1px 9px; margin-bottom: 4px;">${status.label}</div>
      <div style="font-weight: 700;">${e(pin.address)}</div>
      <div style="color: ${SUB};">📅 ${e(pin.date)}<br/>🕒 ${e(pin.hours)}</div>
      ${pin.listingUrl ? `<div><a href="${e(pin.listingUrl)}" target="_blank" rel="noopener" style="color: #0071e3;">View listing →</a></div>` : ''}
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid ${BORDER};">
        <div style="font-weight: 700;">${e(pin.agent.name)}</div>
        ${pin.agent.phone ? `<div><a href="tel:${e(phoneDigits)}" style="color: #0071e3; text-decoration: none;">${e(pin.agent.phone)}</a></div>` : ''}
        ${pin.agent.email ? `<div><a href="mailto:${e(pin.agent.email)}" style="color: #0071e3; text-decoration: none;">${e(pin.agent.email)}</a></div>` : ''}
        <button data-view-agent style="margin-top: 6px; font-size: 12px; font-weight: 600; color: #1d1d1f; background: #f5f5f7; border: 1px solid #d1d1d6; border-radius: 8px; padding: 6px 10px; cursor: pointer; font-family: inherit;">View agent in admin →</button>
      </div>
    </div>`
}

export default function OpenHouseMap({ onViewAgent }: { onViewAgent: (search: string) => void }) {
  const mapDiv = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('Loading map…')
  const [unmapped, setUnmapped] = useState<string[]>([])
  const [counts, setCounts] = useState<Record<PinStatus, number> | null>(null)
  // The tab-switch callback changes identity between renders; keep the latest
  // in a ref so marker listeners registered once always call the current one.
  const viewAgentRef = useRef(onViewAgent)
  viewAgentRef.current = onViewAgent

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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }

      const res = await fetch('/api/admin/map', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Could not load open houses')
      const { pins, unmapped: missed }: { pins: Pin[]; unmapped: string[] } = await res.json()

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
      })
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
        marker.addListener('click', () => {
          const holder = document.createElement('div')
          holder.innerHTML = infoWindowHtml(pin)
          holder.querySelector('[data-view-agent]')?.addEventListener('click', () => {
            info.close()
            viewAgentRef.current(pin.agent.email || pin.agent.name)
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
      setMessage(pins.length === 0 ? 'No open houses to map yet.' : '')
      setStatus('ready')
    }

    run().catch((err) => {
      if (cancelled) return
      setMessage(err?.message || 'Something went wrong loading the map.')
      setStatus('error')
    })

    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ marginTop: 18 }}>
      {status !== 'ready' && (
        <div style={{ padding: '14px 0', fontSize: 14, color: status === 'error' ? '#cc0000' : SUB }}>{message}</div>
      )}
      {status === 'ready' && message && (
        <div style={{ padding: '14px 0', fontSize: 14, color: SUB }}>{message}</div>
      )}
      {counts && (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '0 0 12px', fontSize: 13, color: SUB }}>
          {(['current', 'future', 'past'] as PinStatus[]).map((s) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_META[s].color, display: 'inline-block' }} />
              {STATUS_META[s].label} ({counts[s]})
            </span>
          ))}
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
