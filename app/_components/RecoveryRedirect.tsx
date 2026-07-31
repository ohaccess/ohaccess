'use client'
import { useEffect } from 'react'

// Safety net for password-reset links. When Supabase's redirect allowlist
// doesn't include /update-password it falls back to the Site URL — this
// homepage — with the recovery credentials (or the expired-link error)
// still riding in the URL hash. Forward them to the password form instead
// of stranding the visitor on marketing copy. No-op on a clean hash.
export default function RecoveryRedirect() {
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('error_code=otp_expired')) {
      window.location.replace('/update-password' + hash)
    }
  }, [])
  return null
}
