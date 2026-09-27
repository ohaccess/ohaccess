import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { deleteAgentAccount, AccountLegalHoldError } from '@/lib/delete-account'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Daily (pg_cron): tear down every account whose scheduled closure date has
// arrived (profiles.deletion_scheduled_at, set by /api/account/close when
// the agent was still inside a paid period). Protected by the shared
// CRON_SECRET like the other crons. A legal hold skips the account and is
// reported in the response so it shows up in the log instead of silently
// living past the date the agent was promised.
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nowIso = new Date().toISOString()
  const { data: due, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, deletion_scheduled_at')
    .not('deletion_scheduled_at', 'is', null)
    .lte('deletion_scheduled_at', nowIso)
    .order('deletion_scheduled_at', { ascending: true })
    .limit(100)
  if (error) {
    console.error('[ACCOUNT-DELETIONS] query failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const deleted: string[] = []
  const held: string[] = []
  const failed: Record<string, string> = {}
  for (const p of due || []) {
    try {
      await deleteAgentAccount(p.id, p, 'cron')
      deleted.push(p.email || p.id)
    } catch (e) {
      if (e instanceof AccountLegalHoldError) {
        held.push(p.email || p.id)
      } else {
        failed[p.email || p.id] = e instanceof Error ? e.message : 'Unknown error'
      }
    }
  }

  console.log(`[ACCOUNT-DELETIONS] run at ${nowIso}: ${deleted.length} deleted, ${held.length} held, ${Object.keys(failed).length} failed`)
  if (held.length) {
    console.warn('[ACCOUNT-DELETIONS] past their closure date but under legal hold:', held)
  }
  return NextResponse.json({ ranAt: nowIso, deleted, held, failed })
}

export async function POST(request: Request) { return handle(request) }
export async function GET(request: Request) { return handle(request) }
