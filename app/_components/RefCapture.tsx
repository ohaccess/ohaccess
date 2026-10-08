'use client'

import { useEffect } from 'react'
import {
  ATTRIBUTION_COOKIE_MAX_AGE_DAYS,
  REF_COOKIE,
  UTM_COOKIE,
  attributionFromUrl,
  encodeUtmCookieValue,
  readCookie,
} from '@/lib/attribution'

const MAX_REF_LENGTH = 64

// First-touch capture of marketing attribution into 30-day cookies:
//   ?ref=<code>  →  ohaccess_ref   (referral links, printed codes, ad ?ref=)
//   utm_*        →  ohaccess_utm   (posts, ads, outreach links; + landing page)
// If a cookie is already set, leave it alone — the first source that brought
// the visitor in keeps the credit. The signup form and the profile
// auto-create read these back (lib/attribution).
export default function RefCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const maxAge = ATTRIBUTION_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60
      const secure = window.location.protocol === 'https:' ? '; Secure' : ''
      const setCookie = (name: string, value: string) => {
        document.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`
      }

      const raw = params.get('ref')
      if (raw) {
        // Allow letters, numbers, dash, underscore, dot. Reject anything else
        // so a stray ?ref=<script> can never reach the report or DB.
        const clean = raw.trim().slice(0, MAX_REF_LENGTH).toLowerCase()
        if (/^[a-z0-9._-]+$/.test(clean) && !readCookie(document.cookie, REF_COOKIE)) {
          setCookie(REF_COOKIE, encodeURIComponent(clean))
        }
      }

      const utm = attributionFromUrl(window.location.search, window.location.pathname)
      if (utm && !readCookie(document.cookie, UTM_COOKIE)) {
        setCookie(UTM_COOKIE, encodeUtmCookieValue(utm))
      }
    } catch {
      // Cookie write blocked (private mode, etc.) — fail silently.
    }
  }, [])

  return null
}
