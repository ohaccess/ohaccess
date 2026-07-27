import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Monthly retention purge (pg_cron, 1st of the month): enforces Privacy
// Policy §5 — visitor data and its technical metadata are kept up to 3
// years (36 months) from collection, then permanently deleted. Covers the
// LIVE visitors table (which the opportunistic archive/scan purges never
// touched), plus visitor_archive and qr_scans as a scheduled backstop to
// their existing opportunistic purges. Protected by the shared CRON_SECRET
// like the report/reminder crons.
//
// Every delete here skips rows under a preservation hold (migration 041).
// The response reports how many expired rows were withheld, so a hold that
// someone forgot to release shows up in the monthly log instead of silently
// retaining records past the promised window.
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nowIso = new Date().toISOString()
  // Same 3-year constant the archive purge_after clock uses (3 × 365 days).
  const cutoffIso = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString()

  const purged: Record<string, number | string> = {}
  const held: Record<string, number> = {}

  // Count the expired-but-held rows first, so the withheld total is measured
  // against the same cutoff the delete below uses.
  const countHeld = async (table: string, column: string, cutoff: string) => {
    const { count } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .lt(column, cutoff)
      .eq('legal_hold', true)
    return count || 0
  }

  // Live visitor registrations — collection date is registered_at.
  {
    held.visitors = await countHeld('visitors', 'registered_at', cutoffIso)
    const { count, error } = await supabase
      .from('visitors')
      .delete({ count: 'exact' })
      .lt('registered_at', cutoffIso)
      .eq('legal_hold', false)
    purged.visitors = error ? `error: ${error.message}` : count || 0
  }

  // Archived visitor records — purge_after was computed at archive time as
  // original registration + 3 years, so it's the authoritative clock here.
  {
    held.visitor_archive = await countHeld('visitor_archive', 'purge_after', nowIso)
    const { count, error } = await supabase
      .from('visitor_archive')
      .delete({ count: 'exact' })
      .lt('purge_after', nowIso)
      .eq('legal_hold', false)
    purged.visitor_archive = error ? `error: ${error.message}` : count || 0
  }

  // QR scan log — collection date is the scan itself.
  {
    held.qr_scans = await countHeld('qr_scans', 'created_at', cutoffIso)
    const { count, error } = await supabase
      .from('qr_scans')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffIso)
      .eq('legal_hold', false)
    purged.qr_scans = error ? `error: ${error.message}` : count || 0
  }

  const heldTotal = Object.values(held).reduce((a, b) => a + b, 0)
  console.log(`[DATA-RETENTION] purge run at ${nowIso}, cutoff ${cutoffIso}:`, purged)
  if (heldTotal > 0) {
    console.warn(
      `[DATA-RETENTION] ${heldTotal} expired rows WITHHELD under legal hold:`,
      held,
      '— confirm the matter is still open (see legal_holds).'
    )
  }
  return NextResponse.json({ cutoff: cutoffIso, purged, heldPastRetention: held })
}

export async function POST(request: Request) { return handle(request) }
export async function GET(request: Request) { return handle(request) }
