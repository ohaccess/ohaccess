import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'

type ProfileRow = {
  referral_source: string | null
  tier: string | null
  created_at: string
  full_name: string | null
  email: string | null
}

type SourceAgent = {
  name: string
  email: string
  tier: string
  created_at: string
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('referral_source, tier, created_at, full_name, email')
    .not('referral_source', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const buckets = new Map<
    string,
    { source: string; signups: number; pro: number; first: string; last: string; agents: SourceAgent[] }
  >()
  for (const row of (data || []) as ProfileRow[]) {
    const source = row.referral_source!
    const isPro = (row.tier || '').toLowerCase() === 'pro'
    const agent: SourceAgent = {
      name: row.full_name || row.email || 'Unknown',
      email: row.email || '',
      tier: row.tier || 'free',
      created_at: row.created_at,
    }
    const existing = buckets.get(source)
    if (existing) {
      existing.signups += 1
      if (isPro) existing.pro += 1
      if (row.created_at < existing.first) existing.first = row.created_at
      if (row.created_at > existing.last) existing.last = row.created_at
      existing.agents.push(agent)
    } else {
      buckets.set(source, {
        source,
        signups: 1,
        pro: isPro ? 1 : 0,
        first: row.created_at,
        last: row.created_at,
        agents: [agent],
      })
    }
  }

  const rows = Array.from(buckets.values())
    .map((b) => ({
      source: b.source,
      signups: b.signups,
      pro: b.pro,
      conversion_pct: b.signups > 0 ? Math.round((b.pro / b.signups) * 1000) / 10 : 0,
      first_signup: b.first,
      last_signup: b.last,
      agents: b.agents.sort((x, y) => (x.created_at < y.created_at ? 1 : -1)),
    }))
    .sort((a, b) => b.signups - a.signups)

  return NextResponse.json({ sources: rows })
}
