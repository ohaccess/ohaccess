import { describe, it, expect } from 'vitest'
import {
  findAccountDuplicates,
  listBouncedEmails,
  listFakePhones,
  normalizeLicenceKey,
  type QualityProfile,
  type QualityVisitor,
} from '@/lib/admin-quality'

const profile = (over: Partial<QualityProfile> & { id: string }): QualityProfile => ({
  name: over.id,
  email: `${over.id}@login.test`,
  display_email: null,
  license_number: null,
  state: null,
  brokerage_id: null,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
})

describe('findAccountDuplicates', () => {
  it('groups accounts that show the same business email, ignoring case and spaces', () => {
    const dupes = findAccountDuplicates([
      profile({ id: 'a', display_email: 'Sarah@PremierRE.com ', created_at: '2026-02-01T00:00:00Z' }),
      profile({ id: 'b', display_email: 'sarah@premierre.com', created_at: '2026-03-01T00:00:00Z' }),
      profile({ id: 'c', display_email: 'bob@other.com' }),
      profile({ id: 'd', display_email: '' }),
      profile({ id: 'e', display_email: '' }),
    ])
    expect(dupes.displayEmails).toHaveLength(1)
    expect(dupes.displayEmails[0].value).toBe('sarah@premierre.com')
    expect(dupes.displayEmails[0].members.map((m) => m.id)).toEqual(['b', 'a'])
    expect(dupes.displayEmails[0].sameTeam).toBe(false)
  })

  it('does not count blank or malformed display emails as a shared value', () => {
    const dupes = findAccountDuplicates([
      profile({ id: 'a', display_email: 'not an email' }),
      profile({ id: 'b', display_email: 'not an email' }),
    ])
    expect(dupes.displayEmails).toEqual([])
  })

  it('flags a shared office inbox but marks it as the same team', () => {
    const dupes = findAccountDuplicates([
      profile({ id: 'a', display_email: 'office@team.com', brokerage_id: 'team-1' }),
      profile({ id: 'b', display_email: 'office@team.com', brokerage_id: 'team-1' }),
    ])
    expect(dupes.displayEmails[0].sameTeam).toBe(true)
  })

  it('only treats a licence as shared when the state matches too', () => {
    const dupes = findAccountDuplicates([
      profile({ id: 'tx1', license_number: '0123-456', state: 'TX' }),
      profile({ id: 'tx2', license_number: '0123 456', state: 'tx' }),
      profile({ id: 'ca', license_number: '0123456', state: 'CA' }),
      profile({ id: 'none', license_number: '0123456', state: null }),
    ])
    expect(dupes.licences).toHaveLength(1)
    expect(dupes.licences[0].members.map((m) => m.id).sort()).toEqual(['tx1', 'tx2'])
  })

  it('normalises licence keys', () => {
    expect(normalizeLicenceKey(' 12-34 ', 'tx')).toBe('TX:1234')
    expect(normalizeLicenceKey('12', 'TX')).toBeNull()
    expect(normalizeLicenceKey('123456', '')).toBeNull()
  })

  it('puts the biggest cluster first', () => {
    const dupes = findAccountDuplicates([
      profile({ id: 'a', display_email: 'two@x.com' }),
      profile({ id: 'b', display_email: 'two@x.com' }),
      profile({ id: 'c', display_email: 'three@x.com' }),
      profile({ id: 'd', display_email: 'three@x.com' }),
      profile({ id: 'e', display_email: 'three@x.com' }),
    ])
    expect(dupes.displayEmails.map((g) => g.value)).toEqual(['three@x.com', 'two@x.com'])
  })
})

const visitor = (over: Partial<QualityVisitor> & { id: string }): QualityVisitor => ({
  name: `Visitor ${over.id}`,
  email: null,
  phone: null,
  email_status: null,
  sms_status: null,
  phone_line_type: null,
  delivery_updated_at: null,
  registered_at: '2026-05-01T00:00:00Z',
  openHouseAddress: '1 Main St',
  agentName: 'Agent A',
  ...over,
})

describe('listBouncedEmails', () => {
  it('merges the suppression ledger with older visitor bounces, one row per address, newest first', () => {
    const rows = listBouncedEmails(
      [
        { email: 'Dead@Agent.com', reason: 'bounced', source: 'email.bounced', created_at: '2026-06-01T00:00:00Z' },
        { email: 'angry@buyer.com', reason: 'complained', source: 'email.complained', created_at: '2026-06-03T00:00:00Z' },
      ],
      [
        visitor({ id: 'v1', email: 'old@buyer.com', email_status: 'bounced', delivery_updated_at: '2026-06-02T00:00:00Z' }),
        visitor({ id: 'v2', email: 'angry@buyer.com', email_status: 'complained', delivery_updated_at: '2026-05-20T00:00:00Z' }),
        visitor({ id: 'v3', email: 'fine@buyer.com', email_status: 'delivered' }),
      ],
      [{ name: 'Dead Agent', email: 'dead@agent.com' }]
    )
    expect(rows.map((r) => r.email)).toEqual(['angry@buyer.com', 'old@buyer.com', 'dead@agent.com'])
    expect(rows[0]).toMatchObject({ reason: 'complained', kind: 'visitor', who: 'Visitor v2 · 1 Main St' })
    expect(rows[1]).toMatchObject({ reason: 'bounced', kind: 'visitor' })
    expect(rows[2]).toMatchObject({ reason: 'bounced', kind: 'agent', who: 'Dead Agent' })
  })
})

describe('listFakePhones', () => {
  it('lists undeliverable and VoIP numbers, undeliverable winning when both apply, newest first', () => {
    const rows = listFakePhones([
      visitor({ id: 'ok', phone: '(512) 555-0100', sms_status: 'delivered', phone_line_type: 'mobile' }),
      visitor({ id: 'voip', phone: '(512) 555-0101', sms_status: 'delivered', phone_line_type: 'nonFixedVoip', registered_at: '2026-05-02T00:00:00Z' }),
      visitor({ id: 'dead', phone: '(512) 555-0102', sms_status: 'undelivered', delivery_updated_at: '2026-05-03T00:00:00Z' }),
      visitor({ id: 'both', phone: '(512) 555-0103', sms_status: 'failed', phone_line_type: 'nonFixedVoip', delivery_updated_at: '2026-05-04T00:00:00Z' }),
      visitor({ id: 'landline', phone: '(512) 555-0104', phone_line_type: 'landline' }),
    ])
    expect(rows.map((r) => `${r.visitorId}:${r.reason}`)).toEqual(['both:undeliverable', 'dead:undeliverable', 'voip:voip'])
  })
})
