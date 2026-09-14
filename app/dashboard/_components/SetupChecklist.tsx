'use client'
import type { CSSProperties } from 'react'
import type { SetupStep, SetupStepId } from '@/lib/setup-checklist'

// "Get set up" card at the top of a new agent's dashboard. The rules for what
// counts as done, and when the card shows at all, live in
// lib/setup-checklist.ts; this just draws the steps and hands each button
// back to the dashboard.

const COPY: Record<SetupStepId, { title: string; body: string; button: string }> = {
  profile: {
    title: 'Add your name and a photo or logo',
    body: 'Visitors see them in every email they get from you.',
    button: 'Open Settings',
  },
  open_house: {
    title: 'Create your first open house',
    body: 'Add the address and time. Visitors get a codeword when they sign in.',
    button: 'Create open house',
  },
  sign: {
    title: 'Print your QR sign',
    body: 'Your permanent QR code always points to your next open house, so you can print it once and reuse it.',
    button: 'Print my sign',
  },
}

export default function SetupChecklist({
  steps,
  needsVerification,
  onAction,
  accentColor,
  onAccent,
  accentBtnBorder,
}: {
  steps: SetupStep[]
  // Not verified yet: creating the first open house starts with a quick phone
  // check, so say so before the agent is surprised by it.
  needsVerification: boolean
  onAction: (id: SetupStepId) => void
  accentColor: string
  onAccent: string
  accentBtnBorder: string
}) {
  const doneCount = steps.filter(s => s.done).length
  // The first unfinished step gets the filled button; later ones stay quiet so
  // there's one obvious next thing to do.
  const nextId = steps.find(s => !s.done)?.id

  const btn = (primary: boolean): CSSProperties => ({
    background: primary ? accentColor : '#f5f5f7',
    color: primary ? onAccent : '#1d1d1f',
    border: primary ? accentBtnBorder : '1px solid #d1d1d6',
    padding: '7px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  })

  return (
    <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '18px 20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1d1d1f' }}>Get set up</div>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#6e6e73' }}>{doneCount} of {steps.length} done</div>
      </div>
      <div style={{ height: '6px', background: '#f2f2f7', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
        <div style={{ width: `${(doneCount / steps.length) * 100}%`, height: '100%', background: '#30d158', borderRadius: '3px', transition: 'width .3s ease' }} />
      </div>

      {steps.map((step, i) => {
        const copy = COPY[step.id]
        const body = step.id === 'open_house' && needsVerification
          ? 'First, a one-minute check of your mobile number. Then add the address and time.'
          : copy.body
        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid #f2f2f7', flexWrap: 'wrap' }}>
            <span aria-hidden style={{
              width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: '700',
              background: step.done ? '#30d158' : '#f2f2f7',
              color: step.done ? 'white' : '#6e6e73',
            }}>{step.done ? '✓' : i + 1}</span>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: step.done ? '#aeaeb2' : '#1d1d1f', textDecoration: step.done ? 'line-through' : 'none' }}>
                {copy.title}
              </div>
              {!step.done && (
                <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '2px', lineHeight: '1.5' }}>{body}</div>
              )}
            </div>
            {!step.done && (
              <button onClick={() => onAction(step.id)} style={btn(step.id === nextId)}>
                {copy.button}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
