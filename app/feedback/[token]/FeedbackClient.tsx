'use client'
import { useState } from 'react'
import { isLightColor, onColor, fillBorder } from '@/lib/colors'
import { STRINGS, FEEDBACK_PRICE_VALUES, type Lang } from '@/lib/register-i18n'
import type { CustomQuestion } from '@/lib/custom-questions'

// The interactive half of /feedback/[token] — the same rating grid, price
// buttons and agent questions as the sign-in success card, restyled only as
// much as standing alone requires (branded header strip, card shell — the
// /checkin page's chrome). Posts to /api/feedback exactly like the success
// card does; the server treats both callers identically.
export default function FeedbackClient({
  token, lang, alreadyDone, address, dateLine, agentName, brokerage, primaryColor, accentColor, questions,
}: {
  token: string
  lang: Lang
  alreadyDone: boolean
  address: string
  dateLine: string
  agentName: string | null
  brokerage: string | null
  primaryColor: string | null
  accentColor: string | null
  questions: CustomQuestion[]
}) {
  const t = STRINGS[lang]
  const [rating, setRating] = useState<number | null>(null)
  const [priceIdx, setPriceIdx] = useState<number | null>(null)
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(alreadyDone)
  const [error, setError] = useState(false)
  const setCustomAnswer = (id: string, value: string) =>
    setCustomAnswers(prev => ({ ...prev, [id]: value }))

  const primary = primaryColor || '#1d1d1f'
  const accent = accentColor || '#0071e3'
  const onPrimary = onColor(primary)
  const onAccent = onColor(accent)
  const primaryIsLight = isLightColor(primary)
  const primaryBtnBorder = fillBorder(primary)
  const accentBtnBorder = fillBorder(accent)
  const font = "'Plus Jakarta Sans', sans-serif"

  const submit = async () => {
    if (rating === null || priceIdx === null) return
    setSubmitting(true)
    setError(false)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          rating,
          price: FEEDBACK_PRICE_VALUES[priceIdx],
          customAnswers,
        }),
      })
      if (!res.ok) throw new Error()
      setDone(true)
    } catch {
      setError(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: font, paddingBottom: '40px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ background: primary, width: '100%', padding: '22px 20px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', fontWeight: 200, color: onPrimary, letterSpacing: '-0.5px' }}>
          oh<span style={{ fontWeight: 700 }}>ACCESS</span>
        </div>
        <div style={{ fontSize: '11px', color: primaryIsLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
          Verified Open House Check-In
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '420px', padding: '18px 16px 0' }}>
        <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '22px 20px' }}>
          <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: 1.5, marginBottom: '16px' }}>
            <strong style={{ color: '#1d1d1f' }}>{address}</strong>
            {dateLine && <><br />{dateLine}</>}
            {agentName && <><br />{`Hosted by ${agentName}${brokerage ? ` · ${brokerage}` : ''}`}</>}
          </div>

          {done ? (
            <div style={{ background: '#e8f9ee', border: '1px solid #b2f0c8', borderRadius: '12px', padding: '14px 16px', fontSize: '13.5px', color: '#1a7a3c', fontWeight: 600, lineHeight: 1.5, textAlign: 'center' }}>
              {t.feedbackThanks}
            </div>
          ) : (
            <>
              <div style={{ fontSize: '15px', color: '#1d1d1f', lineHeight: 1.5, marginBottom: '14px' }}>
                <strong>{t.feedbackAfter}</strong>{t.feedbackIntro.split('{after}')[1]}
              </div>

              {/* Q1 — overall rating, 1–10 */}
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#1d1d1f', lineHeight: 1.45, marginBottom: '8px' }}>
                {t.feedbackQ1}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '5px' }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                  const on = rating === n
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      style={{ aspectRatio: '1', minWidth: 0, borderRadius: '9px', border: on ? accentBtnBorder : '1px solid #d1d1d6', background: on ? accent : '#f5f5f7', color: on ? onAccent : '#1d1d1f', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: font, padding: 0 }}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8e8e93', marginTop: '5px' }}>
                <span>1 · {t.feedbackScaleLow}</span>
                <span>{t.feedbackScaleHigh} · 10</span>
              </div>

              {/* Q2 — price sentiment */}
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#1d1d1f', lineHeight: 1.45, margin: '14px 0 8px' }}>
                {t.feedbackQ2}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {t.feedbackPrices.map((lbl, i) => {
                  const on = priceIdx === i
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPriceIdx(i)}
                      style={{ borderRadius: '9px', border: on ? accentBtnBorder : '1px solid #d1d1d6', background: on ? accent : '#f5f5f7', color: on ? onAccent : '#1d1d1f', fontSize: '13px', fontWeight: 700, padding: '11px 6px', cursor: 'pointer', fontFamily: font }}
                    >
                      {lbl}
                    </button>
                  )
                })}
              </div>

              {/* The agent's own success-screen questions — optional, so they
                  never gate the button. */}
              {questions.map(q => (
                <div key={q.id} style={{ marginTop: '14px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1d1d1f', marginBottom: '7px', lineHeight: 1.45 }}>
                    {q.prompt}
                  </div>
                  {q.type === 'choice' ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                      {q.options.map(opt => {
                        const on = customAnswers[q.id] === opt
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setCustomAnswer(q.id, on ? '' : opt)}
                            style={{ borderRadius: '9px', border: on ? accentBtnBorder : '1px solid #d1d1d6', background: on ? accent : '#f5f5f7', color: on ? onAccent : '#1d1d1f', fontSize: '13px', fontWeight: 700, padding: '11px 14px', cursor: 'pointer', fontFamily: font }}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <input
                      type="text"
                      maxLength={500}
                      value={customAnswers[q.id] || ''}
                      onChange={e => setCustomAnswer(q.id, e.target.value)}
                      style={{ width: '100%', background: '#f5f5f7', border: '1px solid #d1d1d6', borderRadius: '9px', padding: '10px 12px', fontSize: '16px', color: '#1d1d1f', outline: 'none', boxSizing: 'border-box', fontFamily: font }}
                    />
                  )}
                </div>
              ))}

              {error && (
                <div style={{ marginTop: '12px', fontSize: '12.5px', color: '#cc0000', fontWeight: 600 }}>
                  {t.feedbackError}
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={submitting || rating === null || priceIdx === null}
                style={{ marginTop: '16px', width: '100%', background: (rating !== null && priceIdx !== null) ? primary : '#e8e8ed', color: (rating !== null && priceIdx !== null) ? onPrimary : '#aeaeb2', border: (rating !== null && priceIdx !== null) ? primaryBtnBorder : 'none', borderRadius: '12px', padding: '13px', fontSize: '15px', fontWeight: 700, cursor: (submitting || rating === null || priceIdx === null) ? 'default' : 'pointer', fontFamily: font, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? t.feedbackSubmitting : t.feedbackSubmit}
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: '16px', fontSize: '12px', color: '#6e6e73', textAlign: 'center' }}>
          <a href="https://ohaccess.com" style={{ color: '#6e6e73', textDecoration: 'none' }}>Powered by ohACCESS</a> · <span style={{ fontWeight: 600 }}>Patent Pending</span>
        </div>
      </div>
    </main>
  )
}
