'use client'
import { useEffect, useRef, useState } from 'react'
import { RATING_MAX, RATING_COMMENT_MAX } from '@/lib/report-rating'

// The interactive half of /rate/[ohId]/[sig]. Saves the star the agent tapped
// in the email as soon as the page loads, then lets them change it or add a
// comment. Posts to /api/report-rating. ohACCESS chrome (not the agent's
// branding): this is ohACCESS asking the agent, not the agent asking a buyer.

const FONT = "'Plus Jakarta Sans', sans-serif"
const GOLD = '#f5a623'

type Status = 'idle' | 'saving' | 'saved' | 'error'

export default function RateClient({
  openHouseId, sig, tappedScore, savedScore, savedComment, address, dateLine,
}: {
  openHouseId: string
  sig: string
  tappedScore: number | null
  savedScore: number | null
  savedComment: string | null
  address: string
  dateLine: string
}) {
  const [score, setScore] = useState<number | null>(tappedScore ?? savedScore)
  // A tapped star that isn't saved yet starts out "saving" (the effect below
  // sends it); otherwise an existing rating shows as saved.
  const [status, setStatus] = useState<Status>(
    tappedScore !== null && tappedScore !== savedScore ? 'saving' : savedScore !== null ? 'saved' : 'idle'
  )
  const [comment, setComment] = useState(savedComment || '')
  const [commentStatus, setCommentStatus] = useState<Status>(savedComment ? 'saved' : 'idle')
  const sentTap = useRef(false)

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/report-rating', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openHouseId, sig, ...payload }),
    })
    return res.ok
  }

  const saveScore = async (n: number) => {
    try {
      const ok = await post({ score: n })
      setStatus(ok ? 'saved' : 'error')
    } catch {
      setStatus('error')
    }
  }

  // Save the star tapped in the email once, after the page loads in a browser.
  // State is only set in the fetch callbacks, never synchronously here.
  useEffect(() => {
    if (sentTap.current || tappedScore === null || tappedScore === savedScore) return
    sentTap.current = true
    fetch('/api/report-rating', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openHouseId, sig, score: tappedScore }),
    })
      .then(res => setStatus(res.ok ? 'saved' : 'error'))
      .catch(() => setStatus('error'))
  }, [openHouseId, sig, tappedScore, savedScore])

  const pick = (n: number) => {
    setScore(n)
    setStatus('saving')
    void saveScore(n)
  }

  const sendComment = async () => {
    if (score === null) return
    setCommentStatus('saving')
    try {
      const ok = await post({ score, comment })
      setCommentStatus(ok ? 'saved' : 'error')
    } catch {
      setCommentStatus('error')
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: FONT, paddingBottom: '40px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ background: '#1d1d1f', width: '100%', padding: '22px 20px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', fontWeight: 200, color: '#ffffff', letterSpacing: '-0.5px' }}>
          oh<span style={{ fontWeight: 700 }}>ACCESS</span>
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
          Verified Open House Check-In
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '420px', padding: '18px 16px 0' }}>
        <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '22px 20px' }}>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f', marginBottom: '4px' }}>How did ohACCESS work for you today?</div>
          <div style={{ fontSize: '13px', color: '#6e6e73', lineHeight: 1.5, marginBottom: '18px' }}>
            {address}
            {dateLine && <><br />{dateLine}</>}
          </div>

          <div role="radiogroup" aria-label="Rating" style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
            {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map(n => {
              const on = score !== null && n <= score
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={score === n}
                  aria-label={`${n} out of ${RATING_MAX}`}
                  onClick={() => pick(n)}
                  style={{ background: 'none', border: 'none', padding: '2px 4px', fontSize: '40px', lineHeight: 1, cursor: 'pointer', color: on ? GOLD : '#d1d1d6', fontFamily: FONT }}
                >
                  ★
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8e8e93', margin: '4px 6px 0' }}>
            <span>1 · Frustrating</span>
            <span>Loved it · 5</span>
          </div>

          <div style={{ minHeight: '22px', marginTop: '14px', fontSize: '13.5px', fontWeight: 600, textAlign: 'center', color: status === 'error' ? '#cc0000' : status === 'saved' ? '#1a7a3c' : '#6e6e73' }}>
            {status === 'idle' && 'Tap a star to rate your day.'}
            {status === 'saving' && 'Saving…'}
            {status === 'saved' && score !== null && `Thanks! You rated it ${score} out of ${RATING_MAX}.`}
            {status === 'error' && 'Couldn’t save that. Tap a star to try again.'}
          </div>

          {score !== null && (
            <div style={{ marginTop: '18px', borderTop: '1px solid #f2f2f7', paddingTop: '16px' }}>
              <label htmlFor="rating-comment" style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#1d1d1f', marginBottom: '8px' }}>
                Anything we could do better? <span style={{ fontWeight: 400, color: '#8e8e93' }}>(optional)</span>
              </label>
              <textarea
                id="rating-comment"
                value={comment}
                maxLength={RATING_COMMENT_MAX}
                onChange={e => { setComment(e.target.value); if (commentStatus !== 'saving') setCommentStatus('idle') }}
                style={{ width: '100%', minHeight: '90px', background: '#f5f5f7', border: '1px solid #d1d1d6', borderRadius: '10px', padding: '10px 12px', fontSize: '16px', color: '#1d1d1f', outline: 'none', boxSizing: 'border-box', fontFamily: FONT, resize: 'vertical' }}
              />
              <button
                type="button"
                onClick={sendComment}
                disabled={commentStatus === 'saving' || !comment.trim()}
                style={{ marginTop: '10px', width: '100%', background: comment.trim() ? '#1d1d1f' : '#e8e8ed', color: comment.trim() ? '#ffffff' : '#aeaeb2', border: 'none', borderRadius: '12px', padding: '12px', fontSize: '15px', fontWeight: 700, cursor: comment.trim() ? 'pointer' : 'default', fontFamily: FONT, opacity: commentStatus === 'saving' ? 0.7 : 1 }}
              >
                {commentStatus === 'saving' ? 'Sending…' : 'Send comment'}
              </button>
              {commentStatus === 'saved' && (
                <div style={{ marginTop: '8px', fontSize: '12.5px', color: '#1a7a3c', fontWeight: 600, textAlign: 'center' }}>Got it. A real person reads every comment.</div>
              )}
              {commentStatus === 'error' && (
                <div style={{ marginTop: '8px', fontSize: '12.5px', color: '#cc0000', fontWeight: 600, textAlign: 'center' }}>Couldn’t send that. Please try again.</div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: '16px', fontSize: '12px', color: '#6e6e73', textAlign: 'center' }}>
          <a href="https://ohaccess.com" style={{ color: '#6e6e73', textDecoration: 'none' }}>Powered by ohACCESS</a> · <span style={{ fontWeight: 600 }}>Patent Pending</span>
        </div>
      </div>
    </main>
  )
}
