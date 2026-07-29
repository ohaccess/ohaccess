import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'
import { checkOpenHouseHold } from '@/lib/legal-hold'

// Place or release a preservation hold on one open house (migrations 041/042).
//
// Scoped to an open house because that is the shape a real request takes:
// something happened at a property on a date. Holds on one PERSON across
// every property, or on a bare time window in the scan log, stay in SQL —
// see the runbook in migration 041.
//
// The flag and the paper trail are written together. They can't share a
// transaction over PostgREST, so order matters: on place, write the flags
// FIRST and the paper trail second (a hold enforced but unlogged is
// recoverable; a hold logged but unenforced silently loses records). On
// release, the reverse — close the paper trail first, then clear the flags.
export async function POST(request: Request) {
  const admin = await getAuthenticatedUser(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(admin.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    openHouseId?: string
    action?: 'place' | 'release'
    reference?: string
    requestedBy?: string
    note?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const openHouseId = body.openHouseId
  const action = body.action
  if (!openHouseId) return NextResponse.json({ error: 'Missing openHouseId' }, { status: 400 })
  if (action !== 'place' && action !== 'release') {
    return NextResponse.json({ error: 'action must be "place" or "release"' }, { status: 400 })
  }

  const setFlag = async (held: boolean) => {
    // agreement_receipts included (migration 043): after the signed PDF is
    // emailed and discarded, the receipt is the only evidence a signature
    // ceremony happened — precisely what a preservation request is after.
    for (const table of ['visitors', 'visitor_archive', 'qr_scans', 'agreement_receipts'] as const) {
      const { error } = await supabase
        .from(table)
        .update({ legal_hold: held })
        .eq('open_house_id', openHouseId)
      if (error) throw new Error(`${table}: ${error.message}`)
    }
  }

  if (action === 'place') {
    const reference = (body.reference || '').trim()
    const note = (body.note || '').trim()
    if (!reference) {
      return NextResponse.json({ error: 'A matter reference is required' }, { status: 400 })
    }
    if (!note) {
      return NextResponse.json({ error: 'A scope note is required' }, { status: 400 })
    }

    try {
      await setFlag(true)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      console.error(`[LEGAL-HOLD] place FAILED by ${admin.email} on ${openHouseId}: ${message}`)
      return NextResponse.json({ error: `Could not place the hold (${message}).` }, { status: 500 })
    }

    const { error: logErr } = await supabase.from('legal_holds').insert({
      reference,
      requested_by: (body.requestedBy || '').trim() || null,
      scope_note: note,
      placed_by: admin.email,
      open_house_id: openHouseId,
    })
    // The records ARE held at this point. A failed log entry is a paper-trail
    // problem, not a preservation problem — say so rather than implying the
    // hold didn't take.
    if (logErr) {
      console.error(`[LEGAL-HOLD] placed but NOT logged (${openHouseId}): ${logErr.message}`)
      const counts = await checkOpenHouseHold(openHouseId)
      return NextResponse.json({
        held: true,
        counts: counts.counts,
        warning:
          'Records are held, but the paper-trail entry failed to save. Add it by hand in legal_holds.',
      })
    }

    const after = await checkOpenHouseHold(openHouseId)
    console.log(
      `[LEGAL-HOLD] ${admin.email} PLACED hold "${reference}" on ${openHouseId} — ${after.summary}`
    )
    return NextResponse.json({ held: true, counts: after.counts })
  }

  // Release. Irreversible in effect: anything already past its 3-year date is
  // purged on the next run, so this is gated on an explicit confirmation from
  // the caller rather than being a plain toggle.
  const releaseNote = (body.note || '').trim()
  if (!releaseNote) {
    return NextResponse.json(
      { error: 'A release note is required (who confirmed the matter is closed)' },
      { status: 400 }
    )
  }

  const { error: closeErr } = await supabase
    .from('legal_holds')
    .update({
      released_at: new Date().toISOString(),
      released_by: admin.email,
      release_note: releaseNote,
    })
    .eq('open_house_id', openHouseId)
    .is('released_at', null)
  if (closeErr) {
    console.error(`[LEGAL-HOLD] release log FAILED (${openHouseId}): ${closeErr.message}`)
    return NextResponse.json(
      { error: `Could not close the paper trail (${closeErr.message}). Nothing was released.` },
      { status: 500 }
    )
  }

  try {
    await setFlag(false)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error(`[LEGAL-HOLD] release FAILED by ${admin.email} on ${openHouseId}: ${message}`)
    return NextResponse.json(
      { error: `Paper trail closed but flags were not cleared (${message}). Records remain held.` },
      { status: 500 }
    )
  }

  console.log(`[LEGAL-HOLD] ${admin.email} RELEASED hold on ${openHouseId} — ${releaseNote}`)
  return NextResponse.json({ held: false })
}
