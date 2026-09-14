// The admin "Scanned, Didn't Register" panel: which QR scans really became a
// sign-in, and a plain-English reason tag for the ones that didn't. Pure, so
// the admin overview route and its tests share one rule.
import { deviceLabel } from '@/lib/ua-label'
import { SIGNIN_CLOSES_AFTER_END_MS } from '@/lib/signin-window'

export type ScanInput = {
  open_house_id: string | null
  agent_id: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export type RegistrationInput = {
  open_house_id: string | null
  agent_id: string | null
  ip_address: string | null
  user_agent: string | null
  registered_at: string | null
}

// Schedule of the open house a scan points at. Deleted open houses come from
// open_house_archive (visitorCount = sign-ins it had when deleted); ones
// deleted before the archive existed have no entry at all.
export type EventInfo = {
  start_at: string | null
  end_at: string | null
  deleted: boolean
  visitorCount: number | null
}

export type ScanTag = 'during' | 'before' | 'after' | 'closed' | 'test' | 'preview' | 'deleted' | 'unknown'

export type WalkawayGroup = {
  openHouseId: string | null
  agentId: string | null
  ipAddress: string | null
  userAgent: string | null
  count: number
  firstAt: string
  lastAt: string
  tag: ScanTag
}

// A registration this long after the scan still counts as that scan's
// sign-in (filling in the form + waiting for the codeword takes minutes).
// The minute before covers clock differences between the two rows.
export const SIGNIN_MATCH_WINDOW_MS = 30 * 60 * 1000
const SIGNIN_MATCH_SKEW_MS = 60 * 1000

// Scan → registration match. Same open house AND either the same IP, or the
// same browser signing in shortly after. The browser check catches iPhones
// whose IP changes between loading the form and submitting it (iCloud
// Private Relay rotates it, and Wi-Fi to cellular changes it too).
export function buildSignInMatcher(visitors: RegistrationInput[]) {
  const byOpenHouse = new Map<string, RegistrationInput[]>()
  for (const v of visitors) {
    if (!v.open_house_id) continue
    const list = byOpenHouse.get(v.open_house_id)
    if (list) list.push(v)
    else byOpenHouse.set(v.open_house_id, [v])
  }
  return (scan: ScanInput): boolean => {
    if (!scan.open_house_id) return false
    const scannedAt = Date.parse(scan.created_at)
    return (byOpenHouse.get(scan.open_house_id) || []).some((v) => {
      if (scan.ip_address && v.ip_address === scan.ip_address) return true
      if (!scan.user_agent || v.user_agent !== scan.user_agent || !v.registered_at) return false
      const gap = Date.parse(v.registered_at) - scannedAt
      return gap >= -SIGNIN_MATCH_SKEW_MS && gap <= SIGNIN_MATCH_WINDOW_MS
    })
  }
}

// When the scan happened relative to its open house. "after" = the event is
// over but the form is still open; "closed" = the visitor saw the ended card.
// Legacy rows with no structured end time can't be placed once they start.
function timingTag(scannedAt: number, event: EventInfo): ScanTag {
  const start = event.start_at ? Date.parse(event.start_at) : NaN
  const end = event.end_at ? Date.parse(event.end_at) : NaN
  if (!Number.isNaN(start) && scannedAt < start) return 'before'
  if (Number.isNaN(end)) return 'unknown'
  if (scannedAt <= end) return 'during'
  if (scannedAt > end + SIGNIN_CLOSES_AFTER_END_MS) return 'closed'
  return 'after'
}

// Lower = shown when a group's scans disagree. Test/preview describe the
// device, so every scan in a group shares them; among timings, a load during
// the live event is the one worth seeing.
const TAG_RANK: ScanTag[] = ['preview', 'test', 'during', 'before', 'after', 'closed', 'deleted', 'unknown']

export function groupWalkaways(
  scans: ScanInput[],
  opts: {
    visitors: RegistrationInput[]
    events: Map<string, EventInfo>
    // agent id → IPs the agent used when signing up for ohACCESS
    agentSignupIps: Map<string, Set<string>>
    isSignedIn: (scan: ScanInput) => boolean
  }
): WalkawayGroup[] {
  // Agent id → IPs that signed in at each of the agent's open houses, so a
  // device that tested one open house is recognized on the others.
  const agentVisitorIps = new Map<string, { openHouseId: string; ip: string }[]>()
  for (const v of opts.visitors) {
    if (!v.agent_id || !v.open_house_id || !v.ip_address) continue
    const list = agentVisitorIps.get(v.agent_id) || []
    list.push({ openHouseId: v.open_house_id, ip: v.ip_address })
    agentVisitorIps.set(v.agent_id, list)
  }

  const tagFor = (scan: ScanInput): ScanTag => {
    if (deviceLabel(scan.user_agent) === 'Bot') return 'preview'
    const ip = scan.ip_address
    if (ip && scan.agent_id) {
      if (opts.agentSignupIps.get(scan.agent_id)?.has(ip)) return 'test'
      const elsewhere = agentVisitorIps.get(scan.agent_id) || []
      if (elsewhere.some((r) => r.ip === ip && r.openHouseId !== scan.open_house_id)) return 'test'
    }
    const event = scan.open_house_id ? opts.events.get(scan.open_house_id) : undefined
    if (!event) return 'deleted'
    if (event.deleted && event.visitorCount === 0) return 'test'
    return timingTag(Date.parse(scan.created_at), event)
  }

  const groups = new Map<string, WalkawayGroup>()
  for (const scan of scans) {
    if (opts.isSignedIn(scan)) continue
    const key = `${scan.open_house_id}|${scan.ip_address}|${scan.user_agent}`
    const tag = tagFor(scan)
    const g = groups.get(key)
    if (!g) {
      groups.set(key, {
        openHouseId: scan.open_house_id,
        agentId: scan.agent_id,
        ipAddress: scan.ip_address,
        userAgent: scan.user_agent,
        count: 1,
        firstAt: scan.created_at,
        lastAt: scan.created_at,
        tag,
      })
      continue
    }
    g.count++
    if (scan.created_at < g.firstAt) g.firstAt = scan.created_at
    if (scan.created_at > g.lastAt) g.lastAt = scan.created_at
    if (TAG_RANK.indexOf(tag) < TAG_RANK.indexOf(g.tag)) g.tag = tag
  }

  return [...groups.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}
