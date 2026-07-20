import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { escapeHtml } from '@/lib/escape-html'
import { TIMELINE_ORDER } from '@/lib/timeline'
import { getOrCreateSellerReportCode } from '@/lib/report-link'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface Visitor {
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  purchasing_timeline: string | null
  registered_at: string
  verified: boolean
}

function fmtTime(iso: string, tz: string | null): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      ...(tz ? { timeZone: tz } : {}),
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return new Date(iso).toLocaleString('en-US')
  }
}

function buildReportHtml(args: {
  agentName: string
  address: string
  primary: string
  accent: string
  logoUrl: string | null
  visitors: Visitor[]
  tz: string | null
  reportUrl: string | null
}): string {
  const { agentName, address, primary, accent, logoUrl, visitors, tz, reportUrl } = args
  const verified = visitors.filter(v => v.verified).length
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

  // Group by timeline, preserving the priority order then "Other".
  const groups: { label: string; rows: Visitor[] }[] = []
  for (const label of TIMELINE_ORDER) {
    const rows = visitors.filter(v => v.purchasing_timeline === label)
    if (rows.length) groups.push({ label, rows })
  }
  const other = visitors.filter(v => !TIMELINE_ORDER.includes(v.purchasing_timeline || ''))
  if (other.length) groups.push({ label: 'Other / not specified', rows: other })

  const groupHtml = groups.map(g => `
    <div style="margin-top:20px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${escapeHtml(accent)};margin-bottom:8px;">
        ${escapeHtml(g.label)} <span style="color:#aeaeb2;font-weight:600;">· ${g.rows.length}</span>
      </div>
      ${g.rows.map(v => `
        <div style="padding:10px 0;border-top:1px solid #f2f2f7;">
          <div style="font-size:14px;font-weight:600;color:#1d1d1f;">
            ${escapeHtml(`${v.first_name || ''} ${v.last_name || ''}`.trim() || 'Visitor')}
            ${v.verified ? '<span style="color:#30d158;font-size:12px;font-weight:700;"> ✓ verified</span>' : ''}
          </div>
          <div style="font-size:13px;color:#6e6e73;margin-top:2px;">
            ${escapeHtml(v.phone || '—')} · ${escapeHtml(v.email || '—')}
          </div>
          <div style="font-size:11px;color:#aeaeb2;margin-top:2px;">Registered ${escapeHtml(fmtTime(v.registered_at, tz))}</div>
        </div>
      `).join('')}
    </div>
  `).join('')

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1d1d1f;">
    <div style="background:${escapeHtml(primary)};border-radius:14px;padding:20px 22px;color:white;">
      <div style="font-size:18px;font-weight:200;letter-spacing:-0.5px;">oh<span style="font-weight:700;">ACCESS</span></div>
      <div style="font-size:20px;font-weight:700;margin-top:8px;">Your open house report</div>
      <!-- Pre-wrapped in a white, underline-free anchor so mail clients'
           address auto-linking can't restyle it link-blue against the dark
           header (same fix as the reminder email). -->
      <div style="font-size:13px;opacity:0.7;margin-top:2px;"><a href="${escapeHtml(mapsUrl)}" style="color:#ffffff;text-decoration:none;">${escapeHtml(address)}</a></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px;">
      <div style="flex:1;background:#f5f5f7;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#1d1d1f;">${visitors.length}</div>
        <div style="font-size:11px;color:#6e6e73;text-transform:uppercase;letter-spacing:0.5px;">Registrations</div>
      </div>
      <div style="flex:1;background:#f5f5f7;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#1d1d1f;">${verified}</div>
        <div style="font-size:11px;color:#6e6e73;text-transform:uppercase;letter-spacing:0.5px;">Verified at door</div>
      </div>
    </div>
    <div style="font-size:14px;color:#1d1d1f;margin-top:20px;">Hi ${escapeHtml(agentName)}, here are your verified leads, organized by buying timeline — reach out while it's fresh.</div>
    ${visitors.length === 0
      ? '<div style="margin-top:18px;font-size:13px;color:#6e6e73;">No visitors registered at this open house.</div>'
      : groupHtml}
    ${reportUrl && visitors.length > 0 ? `
    <div style="margin-top:24px;background:#f5f5f7;border-radius:12px;padding:16px 18px;">
      <div style="font-size:14px;font-weight:700;color:#1d1d1f;">📊 Share your results with the seller</div>
      <div style="font-size:13px;color:#6e6e73;margin-top:4px;line-height:1.5;">
        A polished report card of this open house — visitor count and buyer timelines only,
        never your leads' contact info. Sellers love seeing the turnout.
      </div>
      <a href="${escapeHtml(reportUrl)}" style="display:inline-block;margin-top:10px;background:${escapeHtml(primary)};color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:9px 16px;border-radius:8px;">View &amp; share the seller report</a>
    </div>` : ''}
    <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e5ea;font-size:11px;color:#aeaeb2;text-align:center;">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" style="max-height:48px;max-width:160px;object-fit:contain;margin-bottom:8px;" /><br/>` : ''}
      Sent by ohACCESS · Tip: export the full list anytime from your dashboard.
    </div>
  </div>`
}

// POST/GET: recurring job (Supabase cron) — send the post-event report for any
// open house that ended ≥30 min ago and hasn't been reported yet. Idempotent
// via report_sent_at. Protected by a shared secret.
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const endedBefore = new Date(now - 30 * 60_000).toISOString() // ended ≥30 min ago
  const notOlderThan = new Date(now - 24 * 60 * 60_000).toISOString() // skip ancient ones

  const { data: due, error } = await supabase
    .from('open_houses')
    .select('id, agent_id, property_address, timezone')
    .is('report_sent_at', null)
    .not('end_at', 'is', null)
    .lte('end_at', endedBefore)
    .gte('end_at', notOlderThan)
    .limit(50)

  if (error) {
    console.error('open-house-reports query failed', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  let processed = 0
  for (const oh of due ?? []) {
    const { data: agent } = await supabase
      .from('profiles')
      .select('full_name, email, display_email, primary_color, accent_color, logo_url')
      .eq('id', oh.agent_id)
      .maybeSingle()

    const to = agent?.display_email || agent?.email
    if (!to) {
      // No address to send to — mark as handled so we don't retry forever.
      await supabase.from('open_houses').update({ report_sent_at: new Date().toISOString() }).eq('id', oh.id)
      continue
    }

    const { data: visitors } = await supabase
      .from('visitors')
      .select('first_name, last_name, email, phone, purchasing_timeline, registered_at, verified')
      .eq('open_house_id', oh.id)
      .order('registered_at', { ascending: true })

    // Shareable seller report card (lazily minted, PII-free by design).
    const reportCode = await getOrCreateSellerReportCode(oh.id, oh.agent_id)
    const reportUrl = reportCode ? `https://www.ohaccess.com/report/${reportCode}` : null

    const html = buildReportHtml({
      agentName: agent?.full_name || 'there',
      address: oh.property_address || 'your open house',
      primary: agent?.primary_color || '#1d1d1f',
      accent: agent?.accent_color || '#0071e3',
      logoUrl: agent?.logo_url || null,
      visitors: (visitors ?? []) as Visitor[],
      tz: oh.timezone,
      reportUrl,
    })

    try {
      await resend.emails.send({
        from: 'ohACCESS <noreply@mail.ohaccess.com>',
        to,
        // Replies reach a monitored inbox instead of bouncing off the send-only
        // noreply subdomain.
        replyTo: 'support@ohaccess.com',
        subject: `Open house report — ${oh.property_address || 'your open house'} (${(visitors ?? []).length} registered)`,
        html,
      })
      await supabase.from('open_houses').update({ report_sent_at: new Date().toISOString() }).eq('id', oh.id)
      processed++
    } catch (e) {
      console.error('Failed to send open house report', { id: oh.id, e })
      // Leave report_sent_at null so the next run retries.
    }
  }

  return NextResponse.json({ processed, considered: (due ?? []).length })
}

export async function POST(request: Request) { return handle(request) }
export async function GET(request: Request) { return handle(request) }
