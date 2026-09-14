import { describe, it, expect } from 'vitest'
import {
  buildUnsubscribeDetails,
  parseAgentEmailKind,
  type OptOutInput,
  type AgentOptOutInput,
  type VisitorInput,
  type InviteInput,
} from '@/lib/unsubscribe-details'

const profiles = [
  { id: 'agentA', email: 'Jane@Realty.com', full_name: 'Jane Agent' },
  { id: 'agentB', email: 'bob@realty.com', full_name: null },
]
const addresses = new Map([
  ['oh1', '94 Ligham Street'],
  ['oh2', '417 Madison Avenue'],
])

const optOut = (over: Partial<OptOutInput> = {}): OptOutInput => ({
  email: 'shopper@example.com',
  opted_out_at: '2026-09-10T12:00:00Z',
  source: 'invite_unsubscribe',
  open_house_id: null,
  agent_id: null,
  ...over,
})
const invite = (over: Partial<InviteInput> = {}): InviteInput => ({
  email: 'shopper@example.com',
  open_house_id: 'oh1',
  agent_id: 'agentA',
  sent_at: '2026-09-01T12:00:00Z',
  ...over,
})

const build = (o: {
  optOuts?: OptOutInput[]
  agentOptOuts?: AgentOptOutInput[]
  visitors?: VisitorInput[]
  invites?: InviteInput[]
}) =>
  buildUnsubscribeDetails({
    optOuts: o.optOuts || [],
    agentOptOuts: o.agentOptOuts || [],
    profiles,
    visitors: o.visitors || [],
    invites: o.invites || [],
    addresses,
  })

describe('parseAgentEmailKind', () => {
  it('accepts only the known agent emails', () => {
    expect(parseAgentEmailKind('tips')).toBe('tips')
    expect(parseAgentEmailKind('weekend_games')).toBe('weekend_games')
    expect(parseAgentEmailKind('evil')).toBeNull()
    expect(parseAgentEmailKind(undefined)).toBeNull()
  })
})

describe('invite unsubscribes', () => {
  it('names the exact open house and agent once recorded', () => {
    const [row] = build({ optOuts: [optOut({ open_house_id: 'oh2', agent_id: 'agentA' })] })
    expect(row.invite).toEqual({ exact: true, openHouses: [{ address: '417 Madison Avenue', agentName: 'Jane Agent' }] })
  })
  it('older opt-outs: one invite before unsubscribing is that invite', () => {
    const [row] = build({ optOuts: [optOut()], invites: [invite()] })
    expect(row.invite).toEqual({ exact: true, openHouses: [{ address: '94 Ligham Street', agentName: 'Jane Agent' }] })
  })
  it('older opt-outs: several invites are listed as candidates, ignoring ones sent after', () => {
    const [row] = build({
      optOuts: [optOut()],
      invites: [
        invite(),
        invite({ open_house_id: 'oh2', agent_id: 'agentB', sent_at: '2026-09-05T12:00:00Z' }),
        invite({ open_house_id: 'oh3', sent_at: '2026-09-11T12:00:00Z' }),
      ],
    })
    expect(row.invite).toEqual({
      exact: false,
      openHouses: [
        { address: '94 Ligham Street', agentName: 'Jane Agent' },
        { address: '417 Madison Avenue', agentName: 'bob@realty.com' },
      ],
    })
  })
  it('shows a deleted open house by placeholder', () => {
    const [row] = build({ optOuts: [optOut({ open_house_id: 'gone', agent_id: 'agentB' })] })
    expect(row.invite?.openHouses[0].address).toBe('(deleted open house)')
  })
})

describe('agent email unsubscribes', () => {
  it('records tips vs weekend games, and marks older ones unrecorded', () => {
    const rows = build({
      agentOptOuts: [
        { email: 'jane@realty.com', drip_opt_out_at: '2026-09-12T00:00:00Z', drip_opt_out_source: 'weekend_games' },
        { email: 'bob@realty.com', drip_opt_out_at: '2026-09-11T00:00:00Z', drip_opt_out_source: null },
      ],
    })
    expect(rows.map((r) => [r.email, r.agentEmail, r.who])).toEqual([
      ['jane@realty.com', 'weekend_games', 'agent'],
      ['bob@realty.com', 'unrecorded', 'agent'],
    ])
  })
})

describe('who the address belongs to', () => {
  it('matches agents and visitors case-insensitively, and lists open houses signed in at newest first', () => {
    const rows = build({
      optOuts: [
        optOut({ email: 'JANE@realty.com', source: 'marketing_unsubscribe' }),
        optOut({ email: 'shopper@example.com', source: 'marketing_unsubscribe' }),
        optOut({ email: 'stranger@example.com', source: 'marketing_unsubscribe' }),
      ],
      visitors: [
        { email: 'Shopper@Example.com', open_house_id: 'oh1', registered_at: '2026-09-12T18:00:00Z' },
        { email: 'shopper@example.com', open_house_id: 'oh2', registered_at: '2026-09-13T18:00:00Z' },
        { email: 'shopper@example.com', open_house_id: 'oh2', registered_at: '2026-09-13T18:05:00Z' },
      ],
    })
    const byEmail = Object.fromEntries(rows.map((r) => [r.email, r]))
    expect(byEmail['jane@realty.com']).toMatchObject({ who: 'agent', agentName: 'Jane Agent', invite: null, agentEmail: null })
    expect(byEmail['shopper@example.com'].who).toBe('visitor')
    expect(byEmail['shopper@example.com'].signedInAt.map((s) => s.address)).toEqual(['417 Madison Avenue', '94 Ligham Street'])
    expect(byEmail['stranger@example.com'].who).toBe('unknown')
  })
  it('merges an address that opted out more than one way', () => {
    const rows = build({
      optOuts: [optOut({ email: 'jane@realty.com', source: 'marketing_unsubscribe', opted_out_at: '2026-09-13T00:00:00Z' })],
      agentOptOuts: [{ email: 'Jane@Realty.com', drip_opt_out_at: '2026-09-12T00:00:00Z', drip_opt_out_source: 'tips' }],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ opted_out_at: '2026-09-12T00:00:00Z', sources: ['marketing_unsubscribe', 'agent_tips'], agentEmail: 'tips' })
  })
})
