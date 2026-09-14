// Details for the /admin/unsubscribes list: for each address, who it belongs
// to (agent, past visitor, or unknown), which open house an invite
// unsubscribe came from, and which agent email a tips/weekend-games
// unsubscribe was clicked in. Pure, so the admin route and its tests share
// one rule.

// Which agent email an ?agent= unsubscribe link was in (migration 054).
export type AgentEmailKind = 'tips' | 'weekend_games'

export function parseAgentEmailKind(value: unknown): AgentEmailKind | null {
  return value === 'tips' || value === 'weekend_games' ? value : null
}

export type OptOutInput = {
  email: string
  opted_out_at: string
  source: string | null
  open_house_id: string | null
  agent_id: string | null
}

export type AgentOptOutInput = {
  email: string | null
  drip_opt_out_at: string
  drip_opt_out_source: string | null
}

export type ProfileInput = { id: string; email: string | null; full_name: string | null }
export type VisitorInput = { email: string | null; open_house_id: string | null; registered_at: string | null }
export type InviteInput = { email: string; open_house_id: string; agent_id: string; sent_at: string }

export type UnsubscribeDetail = {
  email: string
  opted_out_at: string
  sources: string[]
  // agent = has an ohACCESS account; visitor = signed in at an open house
  who: 'agent' | 'visitor' | 'unknown'
  agentName: string | null
  // Open houses this address signed in at, newest first.
  signedInAt: { address: string; registeredAt: string | null }[]
  // Invite unsubscribes only. exact = we know the one invite clicked; older
  // opt-outs (before migration 054) list every invite sent before it.
  invite: { exact: boolean; openHouses: { address: string; agentName: string }[] } | null
  // Agent-email unsubscribes only; 'unrecorded' = before migration 054.
  agentEmail: AgentEmailKind | 'unrecorded' | null
}

const norm = (email: string | null) => (email || '').trim().toLowerCase()

export function buildUnsubscribeDetails(input: {
  optOuts: OptOutInput[]
  agentOptOuts: AgentOptOutInput[]
  profiles: ProfileInput[]
  visitors: VisitorInput[]
  invites: InviteInput[]
  // open house id → display address (live or archived)
  addresses: Map<string, string>
}): UnsubscribeDetail[] {
  const address = (id: string) => input.addresses.get(id) || '(deleted open house)'
  const profileById = new Map(input.profiles.map((p) => [p.id, p]))
  const profileByEmail = new Map<string, ProfileInput>()
  for (const p of input.profiles) if (norm(p.email)) profileByEmail.set(norm(p.email), p)
  const nameOf = (p: ProfileInput | undefined) => (p ? (p.full_name || p.email || 'Unknown').trim() || 'Unknown' : 'Unknown')

  const rows = new Map<string, UnsubscribeDetail>()
  const rowFor = (rawEmail: string | null, at: string, source: string) => {
    const email = norm(rawEmail)
    if (!email) return null
    let row = rows.get(email)
    if (!row) {
      row = { email, opted_out_at: at, sources: [], who: 'unknown', agentName: null, signedInAt: [], invite: null, agentEmail: null }
      rows.set(email, row)
    }
    if (at < row.opted_out_at) row.opted_out_at = at
    if (!row.sources.includes(source)) row.sources.push(source)
    return row
  }

  for (const o of input.optOuts) {
    const row = rowFor(o.email, o.opted_out_at, o.source || 'other')
    if (!row || o.source !== 'invite_unsubscribe') continue
    if (o.open_house_id) {
      row.invite = {
        exact: true,
        openHouses: [{ address: address(o.open_house_id), agentName: nameOf(o.agent_id ? profileById.get(o.agent_id) : undefined) }],
      }
      continue
    }
    // Before migration 054: every invite this address got up to the moment
    // it unsubscribed is a candidate (one invite = that's the one).
    const seen = new Set<string>()
    const openHouses: { address: string; agentName: string }[] = []
    for (const inv of input.invites) {
      if (norm(inv.email) !== row.email || inv.sent_at > o.opted_out_at || seen.has(inv.open_house_id)) continue
      seen.add(inv.open_house_id)
      openHouses.push({ address: address(inv.open_house_id), agentName: nameOf(profileById.get(inv.agent_id)) })
    }
    row.invite = { exact: openHouses.length === 1, openHouses }
  }

  for (const a of input.agentOptOuts) {
    const row = rowFor(a.email, a.drip_opt_out_at, 'agent_tips')
    if (row) row.agentEmail = parseAgentEmailKind(a.drip_opt_out_source) || 'unrecorded'
  }

  for (const row of rows.values()) {
    const profile = profileByEmail.get(row.email)
    if (profile) {
      row.who = 'agent'
      row.agentName = nameOf(profile)
    }
    const visits = input.visitors
      .filter((v) => v.open_house_id && norm(v.email) === row.email)
      .sort((a, b) => (b.registered_at || '').localeCompare(a.registered_at || ''))
    const seen = new Set<string>()
    for (const v of visits) {
      if (seen.has(v.open_house_id as string)) continue
      seen.add(v.open_house_id as string)
      row.signedInAt.push({ address: address(v.open_house_id as string), registeredAt: v.registered_at })
    }
    if (!profile && row.signedInAt.length > 0) row.who = 'visitor'
  }

  return [...rows.values()].sort((a, b) => (a.opted_out_at < b.opted_out_at ? 1 : -1))
}
