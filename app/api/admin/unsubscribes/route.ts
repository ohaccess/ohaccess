import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'
import {
  buildUnsubscribeDetails,
  type OptOutInput,
  type AgentOptOutInput,
  type ProfileInput,
  type VisitorInput,
  type InviteInput,
} from '@/lib/unsubscribe-details'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Everyone who asked ohACCESS to stop emailing them, from both places an
// opt-out is stored:
//   - email_opt_outs: the global suppression list (marketing-email page and
//     open-house invite links). source says which; invite opt-outs carry the
//     open house + agent since migration 054.
//   - profiles.drip_opt_out_at: agents who unsubscribed from tips/reminders
//     (drip_opt_out_source says tips vs weekend games since migration 054).
// One row per address, with who it belongs to and where it came from
// (lib/unsubscribe-details.ts).

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

  let optOuts: OptOutInput[]
  let agentOptOuts: AgentOptOutInput[]
  let profiles: ProfileInput[]
  let visitors: VisitorInput[]
  let invites: InviteInput[] = []
  const addresses = new Map<string, string>()
  try {
    ;[optOuts, agentOptOuts, profiles, visitors] = await Promise.all([
      pageAll<OptOutInput>((from, to) =>
        supabase.from('email_opt_outs').select('email, opted_out_at, source, open_house_id, agent_id').order('email').range(from, to)
      ),
      pageAll<AgentOptOutInput>((from, to) =>
        supabase
          .from('profiles')
          .select('email, drip_opt_out_at, drip_opt_out_source')
          .not('drip_opt_out_at', 'is', null)
          .order('id')
          .range(from, to)
      ),
      pageAll<ProfileInput>((from, to) => supabase.from('profiles').select('id, email, full_name').order('id').range(from, to)),
      pageAll<VisitorInput>((from, to) =>
        supabase.from('visitors').select('email, open_house_id, registered_at').order('id').range(from, to)
      ),
    ])

    // Invites sent to addresses that unsubscribed from one, for opt-outs
    // recorded before migration 054 (visitor_invites.email is normalized).
    const inviteEmails = [
      ...new Set(optOuts.filter((o) => o.source === 'invite_unsubscribe' && !o.open_house_id).map((o) => o.email.trim().toLowerCase())),
    ]
    if (inviteEmails.length > 0) {
      invites = await pageAll<InviteInput>((from, to) =>
        supabase
          .from('visitor_invites')
          .select('email, open_house_id, agent_id, sent_at')
          .in('email', inviteEmails)
          .order('id')
          .range(from, to)
      )
    }

    // Addresses for every open house a row can mention: live first, then the
    // deletion archive for ones since deleted.
    const optedOut = new Set([...optOuts.map((o) => o.email), ...agentOptOuts.map((a) => a.email || '')].map((e) => e.trim().toLowerCase()))
    const ids = new Set<string>()
    for (const o of optOuts) if (o.open_house_id) ids.add(o.open_house_id)
    for (const i of invites) ids.add(i.open_house_id)
    for (const v of visitors) if (v.open_house_id && optedOut.has((v.email || '').trim().toLowerCase())) ids.add(v.open_house_id)
    const idList = [...ids]
    for (let i = 0; i < idList.length; i += 200) {
      const chunk = idList.slice(i, i + 200)
      const [live, archived] = await Promise.all([
        supabase.from('open_houses').select('id, street_address, property_address').in('id', chunk),
        supabase.from('open_house_archive').select('open_house_id, street_address, property_address').in('open_house_id', chunk),
      ])
      if (live.error) throw new Error(live.error.message)
      for (const a of archived.data || []) {
        const addr = (a.street_address || a.property_address || '').trim()
        if (addr) addresses.set(a.open_house_id as string, `${addr} (deleted)`)
      }
      for (const oh of live.data || []) {
        addresses.set(oh.id as string, (oh.street_address || oh.property_address || 'Untitled listing').trim())
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const rows = buildUnsubscribeDetails({ optOuts, agentOptOuts, profiles, visitors, invites, addresses })
  return NextResponse.json({ unsubscribes: rows })
}
