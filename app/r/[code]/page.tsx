import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'

type OpenHouseRow = {
  id: string
  start_at: string | null
  end_at: string | null
  open_house_date: string | null
  created_at: string | null
}

// When does this open house start / end, best effort? Structured start_at /
// end_at (UTC) when present; legacy rows fall back to the free-text date,
// then to created_at so every row still sorts somewhere.
function startTime(oh: OpenHouseRow): number {
  if (oh.start_at) { const t = Date.parse(oh.start_at); if (!Number.isNaN(t)) return t }
  if (oh.open_house_date) { const t = Date.parse(oh.open_house_date); if (!Number.isNaN(t)) return t }
  if (oh.created_at) { const t = Date.parse(oh.created_at); if (!Number.isNaN(t)) return t }
  return 0
}
function isOver(oh: OpenHouseRow, now: number): boolean {
  if (oh.end_at) { const t = Date.parse(oh.end_at); if (!Number.isNaN(t)) return now > t }
  if (oh.open_house_date) {
    const t = Date.parse(oh.open_house_date)
    // Legacy free-text date: treat it as over once the day has passed.
    if (!Number.isNaN(t)) return now > t + 24 * 60 * 60 * 1000
  }
  return false
}

// An agent_qr code is the agent's permanent QR link: it always points at
// their next upcoming (or currently running) open house, and if nothing is
// scheduled it falls back to their most recent one — so a printed sign keeps
// working forever and the agent can always test-scan it.
async function resolveAgentQr(agentId: string): Promise<string | null> {
  const { data: houses } = await supabase
    .from('open_houses')
    .select('id, start_at, end_at, open_house_date, created_at')
    .eq('agent_id', agentId)

  if (!houses || houses.length === 0) return null

  const now = Date.now()
  const current = houses.filter(oh => !isOver(oh, now))
  const pick = current.length > 0
    ? current.reduce((a, b) => (startTime(a) <= startTime(b) ? a : b))
    : houses.reduce((a, b) => (startTime(a) >= startTime(b) ? a : b))

  return `/register/${pick.id}`
}

export default async function RedirectPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const { data, error } = await supabase
    .from('short_urls')
    .select('destination_url, clicks, url_type, agent_id')
    .eq('code', code)
    .single()

  if (error || !data) {
    redirect('https://ohaccess.com')
  }

  // Increment click counter
  await supabase
    .from('short_urls')
    .update({ clicks: (data.clicks || 0) + 1 })
    .eq('code', code)

  if (data.url_type === 'agent_qr' && data.agent_id) {
    const target = await resolveAgentQr(data.agent_id)
    if (target) redirect(target)

    // Agent has no open houses at all — show a friendly branded stop instead
    // of a dead link.
    const { data: agent } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', data.agent_id)
      .maybeSingle()

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7', padding: '24px', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
        <div style={{ background: 'white', borderRadius: '24px', padding: '36px 28px', maxWidth: '380px', width: '100%', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏡</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1d1d1f', marginBottom: '8px' }}>
            No open house right now
          </div>
          <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: 1.5 }}>
            {agent?.full_name ? `${agent.full_name} doesn’t` : 'This agent doesn’t'} have an open house scheduled at the moment. Please check back soon!
          </div>
        </div>
      </div>
    )
  }

  redirect(data.destination_url)
}
