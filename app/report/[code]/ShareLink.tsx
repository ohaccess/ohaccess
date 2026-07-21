'use client'
import { useState } from 'react'

// Small, deliberately low-key share affordance under the report cards: the
// native share sheet on phones (agents text the link to sellers, sellers
// forward it onward), clipboard copy on desktop.
export default function ShareLink({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // Dismissed the sheet or share failed — fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  return (
    <div style={{ textAlign: 'center', marginTop: 18 }}>
      <button
        onClick={share}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          color: '#6e6e73',
          textDecoration: 'underline',
          textUnderlineOffset: 3,
          fontFamily: 'inherit',
        }}
      >
        {copied ? 'Link copied!' : 'Share this report'}
      </button>
    </div>
  )
}
