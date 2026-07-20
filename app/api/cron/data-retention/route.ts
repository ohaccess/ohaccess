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

  // Live visitor registrations — collection date is registered_at.
  {
    const { count, error } = await supabase
      .from('visitors')
      .delete({ count: 'exact' })
      .lt('registered_at', cutoffIso)
    purged.visitors = error ? `error: ${error.message}` : count || 0
  }

  // Archived visitor records — purge_after was computed at archive time as
  // original registration + 3 years, so it's the authoritative clock here.
  {
    const { count, error } = await supabase
      .from('visitor_archive')
      .delete({ count: 'exact' })
      .lt('purge_after', nowIso)
    purged.visitor_archive = error ? `error: ${error.message}` : count || 0
  }

  // QR scan log — collection date is the scan itself.
  {
    const { count, error } = await supabase
      .from('qr_scans')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffIso)
    purged.qr_scans = error ? `error: ${error.message}` : count || 0
  }

  console.log(`[DATA-RETENTION] purge run at ${nowIso}, cutoff ${cutoffIso}:`, purged)
  return NextResponse.json({ cutoff: cutoffIso, purged })
}

export async function POST(request: Request) { return handle(request) }
export async function GET(request: Request) { return handle(request) }
