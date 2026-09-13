'use client'
import { useEffect, useRef } from 'react'

// Cloudflare Turnstile bot check for every form that calls Supabase Auth
// with an email/password (sign in, sign up, resend confirmation, reset
// password). Invisible for real people ("interaction-only": a checkbox only
// appears when Cloudflare is unsure).
//
// The check that matters happens INSIDE Supabase: with Bot Protection turned
// on (Supabase → Authentication → Attack Protection), every one of those
// calls must carry a fresh token or Supabase refuses it. Bots that skip our
// form and call the Supabase API directly are stopped the same way.
//
// Inert until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set: renders nothing and the
// token stays undefined, which Supabase accepts while Bot Protection is off.
// Turn-on order (docs/bot-protection-setup.md): site key in Vercel + deploy
// FIRST, then enable Bot Protection in Supabase.
//
// Tokens are single-use: after each auth call, bump `resetSignal` so a fresh
// one is minted for the next attempt.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export const captchaEnabled = !!SITE_KEY

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | null = null

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { scriptPromise = null; reject(new Error('turnstile load failed')) }
    document.head.appendChild(s)
  })
  return scriptPromise
}

export default function Captcha({
  onToken,
  resetSignal = 0,
}: {
  onToken: (token: string | undefined) => void
  resetSignal?: number
}) {
  const el = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false
    loadTurnstile()
      .then(() => {
        if (cancelled || !el.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(el.current, {
          sitekey: SITE_KEY,
          appearance: 'interaction-only',
          'refresh-expired': 'auto',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(undefined),
          'error-callback': () => onToken(undefined),
        })
      })
      .catch(() => { /* the auth call will fail with Supabase's captcha error */ })
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!resetSignal || !widgetId.current || !window.turnstile) return
    onToken(undefined)
    window.turnstile.reset(widgetId.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal])

  if (!SITE_KEY) return null
  return <div ref={el} style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }} />
}

// Shown when a form is submitted before the invisible check has finished.
export const CAPTCHA_WAIT_MESSAGE = 'One moment: we’re finishing a quick security check. Please try again in a few seconds.'
