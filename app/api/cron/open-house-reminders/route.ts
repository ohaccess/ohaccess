import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { escapeHtml } from '@/lib/escape-html'
import { generateCode, isHexColor, safeUrl } from '@/lib/register-helpers'
import { isExpiredPrepaidAccess } from '@/lib/billing-plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

// How far ahead of start_at the reminder goes out. With an hourly cron this
// lands the email 23–24h before the doors open — enough time to print a sign.
const REMINDER_LEAD_MS = 24 * 60 * 60_000

function fmtDay(iso: string, tz: string | null): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      ...(tz ? { timeZone: tz } : {}),
      weekday: 'long', month: 'long', day: 'numeric',
    })
  } catch {
    return new Date(iso).toLocaleDateString('en-US')
  }
}

function fmtClock(iso: string, tz: string | null): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      ...(tz ? { timeZone: tz } : {}),
      hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return new Date(iso).toLocaleTimeString('en-US')
  }
}

// One stable short_urls row per (agent, url_type), created lazily — the same
// pattern /api/agent-qr and /api/referral-link use, but with the service
// client since a cron has no user session. destination is a callback because
// referral links embed their own code in the destination URL.
async function getOrCreateShortUrl(
  agentId: string,
  urlType: string,
  destination: (code: string) => string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('short_urls')
    .select('code')
    .eq('agent_id', agentId)
    .eq('url_type', urlType)
    .maybeSingle()
  if (existing) return existing.code

  let code: string | null = null
  for (let i = 0; i < 10; i++) {
    const candidate = generateCode()
    const { data } = await supabase
      .from('short_urls')
      .select('code')
      .eq('code', candidate)
      .maybeSingle()
    if (!data) { code = candidate; break }
  }
  if (!code) return null

  const { data: created, error } = await supabase
    .from('short_urls')
    .insert({
      code,
      destination_url: destination(code),
      agent_id: agentId,
      url_type: urlType,
    })
    .select('code')
    .single()
  return error || !created ? null : created.code
}

function buildReminderHtml(args: {
  agentName: string
  address: string
  streetAddress: string
  dayLine: string
  timeLine: string
  primary: string
  accent: string
  logoUrl: string | null
  ohQrUrl: string
  ohSignUrl: string
  universalQrUrl: string | null
  universalSignUrl: string | null
  smsSample: string
  emailCodeWord: string
  referralUrl: string | null
}): string {
  const e = escapeHtml
  const {
    agentName, address, streetAddress, dayLine, timeLine, primary, accent,
    logoUrl, ohQrUrl, ohSignUrl, universalQrUrl, universalSignUrl,
    smsSample, emailCodeWord, referralUrl,
  } = args
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

  const sectionTitle = (label: string) => `
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${e(accent)};margin-bottom:8px;">${label}</div>`

  const referralHtml = referralUrl ? `
    <div style="margin-top:16px;background:#f5f5f7;border-radius:12px;padding:16px;">
      ${sectionTitle('Save on your subscription')}
      <div style="font-size:14px;color:#1d1d1f;line-height:1.6;">
        Know an agent who'd want this at their open houses? When someone you refer becomes a paying
        subscriber, you earn <strong>a free month of Pro</strong> — added onto your annual or 2-year plan,
        or a $15 credit on your next bill if you're month-to-month.
      </div>
      <div style="font-size:14px;margin-top:8px;">Your personal link:
        <a href="${e(referralUrl)}" style="color:${e(accent)};font-weight:600;">${e(referralUrl)}</a>
      </div>
    </div>` : ''

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1d1d1f;">
    <div style="background:${e(primary)};border-radius:14px;padding:20px 22px;color:white;">
      <div style="font-size:18px;font-weight:200;letter-spacing:-0.5px;">oh<span style="font-weight:700;">ACCESS</span></div>
      <div style="font-size:20px;font-weight:700;margin-top:8px;">Your open house is coming up</div>
      <!-- Pre-wrapped in a white, underline-free anchor so mail clients'
           address auto-linking can't restyle it link-blue against the dark
           header (the tappable Maps link lives in "When & where" below). -->
      <div style="font-size:13px;opacity:0.7;margin-top:2px;"><a href="${e(mapsUrl)}" style="color:#ffffff;text-decoration:none;">${e(address)}</a></div>
    </div>

    <div style="font-size:14px;margin-top:20px;">Hi ${e(agentName)}, a quick heads-up and pre-flight checklist ahead of your open house.</div>

    <div style="margin-top:16px;background:#f5f5f7;border-radius:12px;padding:16px;">
      ${sectionTitle('When & where')}
      <div style="font-size:15px;font-weight:700;">${e(dayLine)}</div>
      <div style="font-size:14px;color:#6e6e73;margin-top:2px;">${e(timeLine)}</div>
      <div style="font-size:14px;margin-top:6px;">
        <a href="${e(mapsUrl)}" style="color:${e(accent)};font-weight:600;">📍 ${e(address)} — open in Google Maps</a>
      </div>
    </div>

    <div style="margin-top:16px;background:#f5f5f7;border-radius:12px;padding:16px;">
      ${sectionTitle('Bring your sign')}
      <div style="font-size:14px;line-height:1.7;">
        Pack your ohACCESS sign with the QR code — either code works:
        <div style="margin-top:6px;">
          <strong>This open house's QR:</strong>
          <a href="${e(ohSignUrl)}" style="color:${e(accent)};font-weight:600;">🖨 Print branded sign</a>
          <span style="color:#aeaeb2;">·</span>
          <a href="${e(ohQrUrl)}" style="color:${e(accent)};font-weight:600;">download QR only (PNG)</a><br/>
          ${universalQrUrl && universalSignUrl ? `<strong>Your universal QR:</strong>
          <a href="${e(universalSignUrl)}" style="color:${e(accent)};font-weight:600;">🖨 Print branded sign</a>
          <span style="color:#aeaeb2;">·</span>
          <a href="${e(universalQrUrl)}" style="color:${e(accent)};font-weight:600;">download QR only (PNG)</a>
          <span style="color:#6e6e73;">(never goes stale — it always points to your next open house)</span>` : ''}
        </div>
      </div>
      <div style="font-size:13px;color:#6e6e73;line-height:1.6;margin-top:10px;">
        <strong style="color:#1d1d1f;">Placement tip:</strong> put the sign closer to the front door than the street —
        somewhere on the walkway visitors can't miss, with enough room to stop and scan comfortably.
        If it's out by the curb, people breeze right past it.
      </div>
    </div>

    <div style="margin-top:16px;background:#f5f5f7;border-radius:12px;padding:16px;">
      ${sectionTitle('At the door')}
      <div style="font-size:14px;line-height:1.7;">
        ohACCESS works best when <strong>everyone</strong> scans — it's the security layer between the
        street and your seller's home. Greet visitors outside, before they reach the door, and kindly
        insist each one signs in and shares their codeword first. A script that works:
      </div>
      <div style="border-left:3px solid ${e(accent)};padding:8px 12px;margin-top:10px;font-size:14px;line-height:1.7;color:#1d1d1f;font-style:italic;">
        "Hi, welcome! Before we head inside — the sellers have asked that every guest sign in first.
        Just scan the sign right here and it'll send you today's codeword. Tell me the word and
        you're in — takes about 20 seconds, and then the whole home is yours to explore."
      </div>
      <div style="font-size:13px;color:#6e6e73;margin-top:8px;">If someone hesitates:</div>
      <div style="border-left:3px solid ${e(accent)};padding:8px 12px;margin-top:6px;font-size:14px;line-height:1.7;color:#1d1d1f;font-style:italic;">
        "I completely understand. It's the one thing the sellers asked of me — everyone signs in
        before stepping inside, myself included, so they always know who's been in their home.
        Your info comes straight to me for feedback and follow-up — it's never sold."
      </div>
    </div>

    <div style="margin-top:16px;background:#f5f5f7;border-radius:12px;padding:16px;">
      ${sectionTitle('What your visitors will receive')}
      <div style="font-size:13px;color:#6e6e73;margin-bottom:8px;">These are live samples using this open house's actual codewords.</div>
      <div style="font-size:12px;color:#6e6e73;margin-bottom:4px;">Text message:</div>
      <div style="background:#e5e5ea;border-radius:16px;padding:10px 14px;font-size:14px;line-height:1.5;color:#1d1d1f;max-width:420px;">
        ${e(smsSample)}
      </div>
      <div style="font-size:12px;color:#6e6e73;margin:12px 0 4px;">Email:</div>
      <div style="background:#ffffff;border:1px solid #e5e5ea;border-radius:10px;padding:12px 14px;max-width:420px;">
        <div style="font-size:12px;color:#6e6e73;">Subject: Your ohACCESS codeword: ${e(emailCodeWord)}</div>
        <div style="border:2px dashed #d2d2d7;border-radius:10px;padding:10px;text-align:center;margin-top:8px;">
          <div style="font-size:22px;font-weight:700;letter-spacing:3px;color:#1d1d1f;"><q>${e(emailCodeWord)}</q></div>
        </div>
        <div style="font-size:12px;color:#6e6e73;margin-top:8px;">…plus the property details and your contact card.</div>
      </div>
      <div style="font-size:13px;line-height:1.6;margin-top:10px;color:#1d1d1f;">
        Visitors share the codeword — that's your confirmation their contact info is real and they're checked in.
      </div>
    </div>

    ${referralHtml}

    <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e5ea;font-size:11px;color:#aeaeb2;text-align:center;">
      ${logoUrl ? `<img src="${e(logoUrl)}" style="max-height:48px;max-width:160px;object-fit:contain;margin-bottom:8px;" /><br/>` : ''}
      Sent by <span style="font-weight:300;">oh</span><strong>ACCESS</strong> · You're receiving this because you have an open house scheduled. Manage open houses anytime from your <a href="${e(`${APP_URL}/dashboard`)}" style="color:#aeaeb2;">dashboard</a>.
    </div>
  </div>`
}

// POST/GET: recurring job (Supabase cron) — send a pre-event reminder for any
// open house starting within the next 24h that hasn't been reminded about yet.
// Idempotent via reminder_sent_at. Protected by a shared secret. Mirrors
// app/api/cron/open-house-reports/route.ts.
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const startsAfter = new Date(now).toISOString() // still upcoming
  const startsBefore = new Date(now + REMINDER_LEAD_MS).toISOString() // within the lead window

  const { data: due, error } = await supabase
    .from('open_houses')
    .select('id, agent_id, property_address, street_address, timezone, start_at, end_at, code_word, code_word_email')
    .is('reminder_sent_at', null)
    .not('start_at', 'is', null)
    .gt('start_at', startsAfter)
    .lte('start_at', startsBefore)
    .limit(50)

  if (error) {
    console.error('open-house-reminders query failed', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  let processed = 0
  for (const oh of due ?? []) {
    const { data: agent } = await supabase
      .from('profiles')
      .select('full_name, email, display_email, primary_color, accent_color, logo_url, brokerage_id, tier, billing_interval, stripe_subscription_id, current_period_end')
      .eq('id', oh.agent_id)
      .maybeSingle()

    const to = agent?.display_email || agent?.email
    if (!to) {
      // No address to send to — mark as handled so we don't retry forever.
      await supabase.from('open_houses').update({ reminder_sent_at: new Date().toISOString() }).eq('id', oh.id)
      continue
    }

    // Team/brokerage members inherit their team's branding, matching every
    // other email we send (see register route).
    let brandColor = agent?.primary_color
    let brandLogo = agent?.logo_url
    if (agent?.brokerage_id) {
      const { data: brokerage } = await supabase
        .from('brokerages')
        .select('primary_color, logo_url')
        .eq('id', agent.brokerage_id)
        .maybeSingle()
      if (brokerage?.primary_color) brandColor = brokerage.primary_color
      if (brokerage?.logo_url) brandLogo = brokerage.logo_url
    }

    // Sign + QR links for the per-event code and the agent's permanent code
    // (created lazily here if they've never opened the QR panel). /api/sign
    // serves the same printable branded sign as the dashboard QR modal.
    const ohQrUrl = `${APP_URL}/api/qrcode?url=${encodeURIComponent(`https://ohaccess.com/register/${oh.id}`)}`
    const ohSignUrl = `${APP_URL}/api/sign?oh=${oh.id}`
    const agentQrCode = await getOrCreateShortUrl(oh.agent_id, 'agent_qr', () => 'https://ohaccess.com')
    const universalQrUrl = agentQrCode
      ? `${APP_URL}/api/qrcode?url=${encodeURIComponent(`https://ohaccess.com/r/${agentQrCode}`)}`
      : null
    const universalSignUrl = agentQrCode ? `${APP_URL}/api/sign?code=${agentQrCode}` : null

    // Referral nudge is Pro-only by design — team/brokerage members don't pay
    // their own renewal, so there's nothing for the reward to attach to
    // (same gate as /api/referral-link).
    let referralUrl: string | null = null
    if (agent?.tier === 'pro' && !isExpiredPrepaidAccess(agent)) {
      const code = await getOrCreateShortUrl(oh.agent_id, 'referral', c => `https://ohaccess.com/?ref=${c}`)
      if (code) referralUrl = `https://ohaccess.com/r/${code}`
    }

    // Live samples mirror the real visitor messages built in the register
    // route: same SMS base copy, same email subject/code box. Legacy open
    // houses only have code_word, so reuse it for email.
    const streetAddress = oh.street_address || oh.property_address || ''
    const smsSample = `Codeword at ${streetAddress} is "${oh.code_word || ''}". Share with host for access. Reply STOP to opt out.`
    const emailCodeWord = oh.code_word_email || oh.code_word || ''

    const dayLine = fmtDay(oh.start_at, oh.timezone)
    const timeLine = oh.end_at
      ? `${fmtClock(oh.start_at, oh.timezone)} – ${fmtClock(oh.end_at, oh.timezone)}`
      : fmtClock(oh.start_at, oh.timezone)

    const html = buildReminderHtml({
      agentName: agent?.full_name || 'there',
      address: oh.property_address || 'your open house',
      streetAddress,
      dayLine,
      timeLine,
      primary: brandColor && isHexColor(brandColor) ? brandColor : '#1d1d1f',
      accent: agent?.accent_color && isHexColor(agent.accent_color) ? agent.accent_color : '#0071e3',
      logoUrl: safeUrl(brandLogo) || null,
      ohQrUrl,
      ohSignUrl,
      universalQrUrl,
      universalSignUrl,
      smsSample,
      emailCodeWord,
      referralUrl,
    })

    try {
      await resend.emails.send({
        // hello@ lives on the verified send-only subdomain; replies route to a
        // monitored inbox instead of bouncing.
        from: 'ohACCESS <hello@mail.ohaccess.com>',
        to,
        replyTo: 'support@ohaccess.com',
        subject: `Reminder: your open house at ${oh.property_address || 'your listing'} — ${dayLine}`,
        html,
      })
      await supabase.from('open_houses').update({ reminder_sent_at: new Date().toISOString() }).eq('id', oh.id)
      processed++
    } catch (e) {
      console.error('Failed to send open house reminder', { id: oh.id, e })
      // Leave reminder_sent_at null so the next run retries.
    }
  }

  return NextResponse.json({ processed, considered: (due ?? []).length })
}

export async function POST(request: Request) { return handle(request) }
export async function GET(request: Request) { return handle(request) }
