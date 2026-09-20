import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { escapeHtml } from '@/lib/escape-html'
import { TIMELINE_ORDER } from '@/lib/timeline'
import { getOrCreateSellerReportCode } from '@/lib/report-link'
import { reportRatingUrl } from '@/lib/report-rating-link'
import { RATING_MAX } from '@/lib/report-rating'
import { brandedEmailShell, emailButton, emailEyebrow, resolveEmailBranding, type EmailBrand } from '@/lib/email-shell'
import { buildBrandMarkHtml } from '@/lib/email-cards'

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
  brand: EmailBrand
  brokerage: string | null
  visitors: Visitor[]
  tz: string | null
  reportUrl: string | null
  // Signed /rate links for 1..5 stars (lib/report-rating-link.ts).
  ratingLinks: string[]
}): string {
  const { agentName, address, brand, brokerage, visitors, tz, reportUrl, ratingLinks } = args
  const verified = visitors.filter(v => v.verified).length
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  const feedbackMailto = `mailto:support@ohaccess.com?subject=${encodeURIComponent(`ohACCESS feedback: ${address}`)}`

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
      ${emailEyebrow(`${escapeHtml(g.label)} <span style="color:#aeaeb2;font-weight:600;">· ${g.rows.length}</span>`, brand.accent)}
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

  const statTile = (value: number, label: string) => `
        <td width="50%" style="background:#f6f7f9;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#1d1d1f;">${value}</div>
          <div style="font-size:11px;color:#6e6e73;text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
        </td>`

  // The address is pre-wrapped in an underline-free anchor in the header's own
  // text color so mail clients' address auto-linking can't restyle it
  // link-blue against the header (same fix as the reminder email).
  return brandedEmailShell({
    brand,
    headerTitleHtml: 'Your open house report',
    headerSubHtml: `<a href="${escapeHtml(mapsUrl)}" style="color:${brand.onPrimary};text-decoration:none;">${escapeHtml(address)}</a>`,
    bodyHtml: `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;"><tr>
      ${statTile(visitors.length, 'Registrations')}
      <td width="10" style="width:10px;font-size:0;">&nbsp;</td>
      ${statTile(verified, 'Verified at door')}
    </tr></table>
    <div style="font-size:14px;color:#1d1d1f;margin-top:20px;">Hi ${escapeHtml(agentName)}, here are your verified leads, organized by buying timeline. Reach out while it's fresh.</div>
    ${visitors.length === 0
      ? '<div style="margin-top:18px;font-size:13px;color:#6e6e73;">No visitors registered at this open house.</div>'
      : groupHtml}
    ${reportUrl && visitors.length > 0 ? `
    <div style="margin-top:24px;background:#f6f7f9;border-radius:12px;padding:16px 18px;">
      <div style="font-size:14px;font-weight:700;color:#1d1d1f;">📊 Share your results with the seller</div>
      <div style="font-size:13px;color:#6e6e73;margin-top:4px;line-height:1.5;">
        A polished report card of this open house: visitor count and buyer timelines only,
        never your leads' contact info. Sellers love seeing the turnout.
      </div>
      ${emailButton('View &amp; share the seller report', escapeHtml(reportUrl), brand)}
    </div>` : ''}
    <!-- Agent feedback ask. Shown on every report (zero-visitor events
         included). The star links open /rate, which saves the score (migration
         053) and takes an optional comment. Replies still route to support@
         via replyTo; the mailto button covers clients that bury the reply
         action. -->
    <div style="margin-top:16px;border:1px solid #e5e5ea;border-radius:12px;padding:16px 18px;">
      <div style="font-size:14px;font-weight:700;color:#1d1d1f;">💬 How did ohACCESS work for you today?</div>
      <div style="font-size:13px;color:#6e6e73;margin-top:4px;line-height:1.5;">Tap a number to rate it:</div>
      <div style="margin-top:8px;">
        ${ratingLinks.map((url, i) => `<a href="${escapeHtml(url)}" style="display:inline-block;margin:0 6px 6px 0;background:#ffffff;border:1px solid #d2d2d7;border-radius:8px;padding:8px 12px;font-size:14px;font-weight:700;color:#1d1d1f;text-decoration:none;">${i + 1} <span style="color:#f5a623;">&#9733;</span></a>`).join('')}
      </div>
      <div style="font-size:11px;color:#8e8e93;">1 = frustrating · ${RATING_MAX} = loved it</div>
      <div style="font-size:13px;color:#6e6e73;margin-top:12px;line-height:1.5;">
        What worked, what got in the way, or what you wish it did? Just hit reply.
        A real person reads every note, and your feedback shapes what we build next.
      </div>
      <a href="${escapeHtml(feedbackMailto)}" style="display:inline-block;margin-top:10px;background:#ffffff;color:#1d1d1f;border:1px solid #d2d2d7;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:8px;">Share feedback</a>
    </div>
    ${buildBrandMarkHtml(brand.logoUrl, brokerage, brand.primary)}`,
    footerHtml: 'Tip: export the full list anytime from your dashboard.',
  })
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
      .select('full_name, email, display_email, brokerage, brokerage_id, primary_color, accent_color, logo_url')
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

    // Team/brokerage members inherit their team's branding, by the same rule
    // as every other branded email (lib/email-shell).
    let brokerageRow: { primary_color: string | null; accent_color: string | null; logo_url: string | null } | null = null
    if (agent?.brokerage_id) {
      const { data: brokerage } = await supabase
        .from('brokerages')
        .select('primary_color, accent_color, logo_url')
        .eq('id', agent.brokerage_id)
        .maybeSingle()
      brokerageRow = brokerage ?? null
    }

    const html = buildReportHtml({
      agentName: agent?.full_name || 'there',
      address: oh.property_address || 'your open house',
      brand: resolveEmailBranding(agent, brokerageRow),
      brokerage: agent?.brokerage || null,
      visitors: (visitors ?? []) as Visitor[],
      tz: oh.timezone,
      reportUrl,
      ratingLinks: Array.from({ length: RATING_MAX }, (_, i) => reportRatingUrl(oh.id, i + 1)),
    })

    try {
      await resend.emails.send({
        from: 'ohACCESS <noreply@mail.ohaccess.com>',
        to,
        // Replies reach a monitored inbox instead of bouncing off the send-only
        // noreply subdomain.
        replyTo: 'support@ohaccess.com',
        subject: `Open house report: ${oh.property_address || 'your open house'} (${(visitors ?? []).length} registered)`,
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
