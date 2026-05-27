'use client'

import { useEffect } from 'react'

const COOKIE_NAME = 'ohaccess_ref'
const COOKIE_MAX_AGE_DAYS = 30
const MAX_REF_LENGTH = 64

// First-touch capture: read `?ref=` from the URL and persist to a 30-day
// cookie. If a cookie is already set, leave it alone — the first source
// that brought the visitor in keeps the credit.
export default function RefCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const raw = params.get('ref')
      if (!raw) return

      // Allow letters, numbers, dash, underscore, dot. Reject anything else
      // so a stray ?ref=<script> can never reach the report or DB.
      const clean = raw.trim().slice(0, MAX_REF_LENGTH).toLowerCase()
      if (!/^[a-z0-9._-]+$/.test(clean)) return

      const existing = document.cookie
        .split('; ')
        .find((c) => c.startsWith(`${COOKIE_NAME}=`))
      if (existing) return

      const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60
      const secure = window.location.protocol === 'https:' ? '; Secure' : ''
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(clean)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`
    } catch {
      // Cookie write blocked (private mode, etc.) — fail silently.
    }
  }, [])

  return null
}
