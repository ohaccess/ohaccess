// Pure helpers behind the admin Overview's "Needs Attention", "Bounced
// Emails", "Fake Phone Numbers" and "Email all account holders" panels
// (app/api/admin/overview). Kept free of Supabase so they can be unit-tested.

export type QualityProfile = {
  id: string
  name: string
  email: string | null
  display_email: string | null
  license_number: string | null
  state: string | null
  brokerage_id: string | null
  created_at: string
}

export type DuplicateMember = { id: string; name: string; email: string; created_at: string }

// Accounts that share one value. `sameTeam` is true when every member sits on
// the same brokerage team (an office inbox typed on several agents' profiles
// is normal there; the same email on unrelated accounts is a "same person"
// tell worth a look).
export type DuplicateGroup = { value: string; members: DuplicateMember[]; sameTeam: boolean }

export type AccountDuplicates = {
  // Several logins showing the same business (display) email to visitors.
  displayEmails: DuplicateGroup[]
  // Several logins carrying the same licence number in the same state.
  // A licence number alone is not unique: different states hand out the
  // same digits, so the pair is the key.
  licences: DuplicateGroup[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmailKey(value: string | null | undefined): string | null {
  const key = (value || '').trim().toLowerCase()
  return EMAIL_RE.test(key) ? key : null
}

// "TX 0123-456" and "tx0123456" are the same licence.
export function normalizeLicenceKey(
  licence: string | null | undefined,
  state: string | null | undefined
): string | null {
  const num = (licence || '').replace(/[^a-z0-9]/gi, '').toUpperCase()
  const st = (state || '').trim().toUpperCase()
  if (num.length < 3 || !st) return null
  return `${st}:${num}`
}

function groupBy(
  profiles: QualityProfile[],
  keyOf: (p: QualityProfile) => string | null,
  label: (p: QualityProfile) => string
): DuplicateGroup[] {
  const groups = new Map<string, { value: string; members: QualityProfile[] }>()
  for (const p of profiles) {
    const key = keyOf(p)
    if (!key) continue
    const g = groups.get(key) || { value: label(p), members: [] }
    g.members.push(p)
    groups.set(key, g)
  }
  const out: DuplicateGroup[] = []
  for (const g of groups.values()) {
    if (g.members.length < 2) continue
    const teams = new Set(g.members.map((m) => m.brokerage_id || ''))
    out.push({
      value: g.value,
      sameTeam: teams.size === 1 && !teams.has(''),
      members: g.members
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((m) => ({ id: m.id, name: m.name, email: m.email || '', created_at: m.created_at })),
    })
  }
  // Biggest clusters first, then the most recently created account.
  return out.sort(
    (a, b) => b.members.length - a.members.length || b.members[0].created_at.localeCompare(a.members[0].created_at)
  )
}

export function findAccountDuplicates(profiles: QualityProfile[]): AccountDuplicates {
  return {
    displayEmails: groupBy(
      profiles,
      (p) => normalizeEmailKey(p.display_email),
      (p) => (p.display_email || '').trim().toLowerCase()
    ),
    licences: groupBy(
      profiles,
      (p) => normalizeLicenceKey(p.license_number, p.state),
      (p) => `${(p.state || '').trim().toUpperCase()} ${(p.license_number || '').trim()}`
    ),
  }
}

// ---- Bounced emails -------------------------------------------------------

export type SuppressionRow = { email: string; reason: string; source: string | null; created_at: string }

export type QualityVisitor = {
  id: string
  name: string
  email: string | null
  phone: string | null
  email_status: string | null
  sms_status: string | null
  phone_line_type: string | null
  delivery_updated_at: string | null
  registered_at: string | null
  openHouseAddress: string
  agentName: string
}

export type BouncedEmail = {
  email: string
  reason: 'bounced' | 'complained'
  // Who the address belongs to, when we can tell.
  who: string
  kind: 'agent' | 'visitor' | 'unknown'
  at: string
}

// One row per address: the suppression ledger (any ohACCESS email, since
// migration 060) merged with older visitor codeword bounces recorded before
// the ledger existed. Newest first.
export function listBouncedEmails(
  suppressions: SuppressionRow[],
  visitors: QualityVisitor[],
  agents: { name: string; email: string | null }[]
): BouncedEmail[] {
  const agentByEmail = new Map<string, string>()
  for (const a of agents) {
    const key = normalizeEmailKey(a.email)
    if (key && !agentByEmail.has(key)) agentByEmail.set(key, a.name)
  }
  const visitorByEmail = new Map<string, QualityVisitor>()
  for (const v of visitors) {
    const key = normalizeEmailKey(v.email)
    if (key && !visitorByEmail.has(key)) visitorByEmail.set(key, v)
  }

  const byEmail = new Map<string, BouncedEmail>()
  const add = (email: string, reason: string, at: string | null) => {
    const key = normalizeEmailKey(email)
    if (!key || (reason !== 'bounced' && reason !== 'complained')) return
    const when = at || ''
    const existing = byEmail.get(key)
    if (existing && existing.at >= when) return
    const agent = agentByEmail.get(key)
    const visitor = visitorByEmail.get(key)
    byEmail.set(key, {
      email: key,
      reason,
      who: agent ? agent : visitor ? `${visitor.name} · ${visitor.openHouseAddress}` : '',
      kind: agent ? 'agent' : visitor ? 'visitor' : 'unknown',
      at: when,
    })
  }
  for (const s of suppressions) add(s.email, s.reason, s.created_at)
  for (const v of visitors) {
    if (v.email && (v.email_status === 'bounced' || v.email_status === 'complained')) {
      add(v.email, v.email_status, v.delivery_updated_at || v.registered_at)
    }
  }
  return [...byEmail.values()].sort((a, b) => b.at.localeCompare(a.at))
}

// ---- Fake phone numbers ---------------------------------------------------

export type FakePhoneReason = 'undeliverable' | 'voip'

export type FakePhone = {
  visitorId: string
  phone: string
  name: string
  openHouseAddress: string
  agentName: string
  reason: FakePhoneReason
  at: string
}

// A visitor's number counts as fake when Twilio could not deliver the
// codeword text to it (wrong or dead number: `undelivered` / `failed`), or
// when Lookup says it is a non-fixed VoIP line (TextNow, Google Voice and
// other burner apps). Undeliverable wins when both apply. Newest first.
export function listFakePhones(visitors: QualityVisitor[]): FakePhone[] {
  const out: FakePhone[] = []
  for (const v of visitors) {
    if (!v.phone) continue
    const undeliverable = v.sms_status === 'undelivered' || v.sms_status === 'failed'
    const voip = v.phone_line_type === 'nonFixedVoip'
    if (!undeliverable && !voip) continue
    out.push({
      visitorId: v.id,
      phone: v.phone,
      name: v.name,
      openHouseAddress: v.openHouseAddress,
      agentName: v.agentName,
      reason: undeliverable ? 'undeliverable' : 'voip',
      at: (undeliverable ? v.delivery_updated_at : null) || v.registered_at || '',
    })
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

// ---- Email all account holders ---------------------------------------------

export type MailingListAccount = {
  // The login email (profiles.email, copied from auth.users at sign-up), not
  // the business email shown to visitors.
  email: string | null
  // Agents who unsubscribed from the tips / weekend emails
  // (profiles.drip_opt_out_at) asked not to hear from us; honour that too.
  unsubscribed?: boolean
}

export type MailingList = {
  // Every mailable login address, de-duplicated and lowercased, A to Z.
  emails: string[]
  excluded: { unsubscribed: number; bounced: number }
}

// The BCC list behind the admin "Email all account holders" panel: every
// account holder's login email minus anyone who asked to be unsubscribed
// (email_opt_outs, drip opt-out) and every address Resend reported as
// bounced or complained (email_suppressions). An address is counted once
// however many lists it sits on; unsubscribed wins over bounced.
export function buildMailingList(
  accounts: MailingListAccount[],
  optOutEmails: Iterable<string>,
  suppressedEmails: Iterable<string>
): MailingList {
  const optedOut = new Set<string>()
  for (const e of optOutEmails) {
    const key = normalizeEmailKey(e)
    if (key) optedOut.add(key)
  }
  const suppressed = new Set<string>()
  for (const e of suppressedEmails) {
    const key = normalizeEmailKey(e)
    if (key) suppressed.add(key)
  }

  const keep = new Set<string>()
  const unsubscribed = new Set<string>()
  const bounced = new Set<string>()
  for (const a of accounts) {
    const key = normalizeEmailKey(a.email)
    if (!key) continue
    if (a.unsubscribed || optedOut.has(key)) unsubscribed.add(key)
    else if (suppressed.has(key)) bounced.add(key)
    else keep.add(key)
  }
  // One account unsubscribed and another with the same login address is
  // impossible (logins are unique), but a drip opt-out flag on one row and a
  // clean duplicate elsewhere should still exclude the address.
  for (const key of unsubscribed) {
    keep.delete(key)
    bounced.delete(key)
  }
  for (const key of bounced) keep.delete(key)

  return {
    emails: [...keep].sort(),
    excluded: { unsubscribed: unsubscribed.size, bounced: bounced.size },
  }
}
