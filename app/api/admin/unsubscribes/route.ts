import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Everyone who asked ohACCESS to stop emailing them, from both places an
// opt-out is stored:
//   - email_opt_outs: the global suppression list (marketing-email page and
//     open-house invite links). source says which.
//   - profiles.drip_opt_out_at: agents who unsubscribed from tips/reminders.
// One row per address; an address in both keeps its earliest time and lists
// every way it opted out.

type Row = { email: string; opted_out_at: string; sources: string[] }

const PAGE = 1000

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < PAGE) return out
  }
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let optOuts: { email: string; opted_out_at: string; source: string | null }[]
  let agents: { email: string | null; drip_opt_out_at: string }[]
  try {
    optOuts = await pageAll((from, to) =>
      supabase.from('email_opt_outs').select('email, opted_out_at, source').order('email').range(from, to)
    )
    agents = await pageAll((from, to) =>
      supabase.from('profiles').select('email, drip_opt_out_at').not('drip_opt_out_at', 'is', null).order('id').range(from, to)
    )
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const byEmail = new Map<string, Row>()
  const add = (rawEmail: string | null, at: string, source: string) => {
    const email = (rawEmail || '').trim().toLowerCase()
    if (!email) return
    const row = byEmail.get(email)
    if (!row) {
      byEmail.set(email, { email, opted_out_at: at, sources: [source] })
      return
    }
    if (at < row.opted_out_at) row.opted_out_at = at
    if (!row.sources.includes(source)) row.sources.push(source)
  }
  for (const o of optOuts) add(o.email, o.opted_out_at, o.source || 'other')
  for (const a of agents) add(a.email, a.drip_opt_out_at, 'agent_tips')

  const rows = Array.from(byEmail.values()).sort((a, b) => (a.opted_out_at < b.opted_out_at ? 1 : -1))
  return NextResponse.json({ unsubscribes: rows })
}
