import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { Resend } from 'resend'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { escapeHtml } from '@/lib/escape-html'
import { normalizePhone } from '@/lib/phone'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

// Base URL Twilio posts SMS delivery updates back to. Use the www host so the
// callback isn't lost to the apex→www 308 redirect.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

const TRIAL_LIMIT = 25
const SMS_MAX_LENGTH = 160

function generateCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function createShortUrl(destinationUrl: string, agentId: string, openHouseId: string, urlType: string): Promise<string | null> {
  let code = generateCode()
  let attempts = 0
  while (attempts < 10) {
    const { data } = await supabase.from('short_urls').select('code').eq('code', code).maybeSingle()
    if (!data) break
    code = generateCode()
    attempts++
  }
  const { error } = await supabase.from('short_urls').insert({
    code,
    destination_url: destinationUrl,
    agent_id: agentId,
    open_house_id: openHouseId,
    url_type: urlType
  })
  if (error) {
    console.error('Short URL creation error:', error)
    return null
  }
  return `https://ohaccess.com/r/${code}`
}

// Safely append optional URLs without exceeding SMS_MAX_LENGTH.
function buildSmsBody(base: string, extras: { label: string; url: string }[]): string {
  let body = base
  for (const extra of extras) {
    const candidate = `${body} ${extra.label}: ${extra.url}`
    if (candidate.length <= SMS_MAX_LENGTH) body = candidate
  }
  return body
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false
  return /^https?:\/\//i.test(value)
}

function safeUrl(value: string | null | undefined): string {
  return isHttpUrl(value) ? value : ''
}

function isHexColor(value: string | null | undefined): boolean {
  return !!value && /^#[0-9a-fA-F]{3,8}$/.test(value)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      purchasingTimeline,
      openHouseId
    } = body

    if (!firstName || !lastName || !email || !phone || !openHouseId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const ip = getClientIp(request)

    // Rate limits — per phone, per open house, per IP.
    const phoneLimit = await checkRateLimit(`phone:${phone}`, 'register', 2, 3600)
    if (!phoneLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many registrations for this phone number. Please try again later.' },
        { status: 429 }
      )
    }

    const ohLimit = await checkRateLimit(`oh:${openHouseId}`, 'register', 30, 3600)
    if (!ohLimit.allowed) {
      return NextResponse.json(
        { error: 'This open house has reached its registration limit for the hour. Please try again later.' },
        { status: 429 }
      )
    }

    const ipLimit = await checkRateLimit(`ip:${ip}`, 'register', 20, 3600)
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Look up open house + agent profile
    const { data: openHouse, error: ohError } = await supabase
      .from('open_houses')
      .select('*, profiles(*)')
      .eq('id', openHouseId)
      .single()

    if (ohError || !openHouse) {
      return NextResponse.json({ error: 'Open house not found' }, { status: 404 })
    }

    const agent = openHouse.profiles
    // Two code words: the SMS (text) word is primary; the email word is a
    // fallback. Legacy open houses only have code_word, so reuse it for email.
    const smsCodeWord = openHouse.code_word
    const emailCodeWord = openHouse.code_word_email || openHouse.code_word
    const streetAddress = openHouse.street_address || openHouse.property_address
    const fullAddress = openHouse.property_address
    const now = new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'short',
      timeStyle: 'short'
    })

    const agentTier = agent?.tier || 'free'
    // A 2-year prepay is a one-time payment with no auto-renew, so the row still
    // reads tier=paid after the access date passes. Treat an expired prepay as
    // free here too (the dashboard already does) so lapsed agents are capped
    // server-side and don't get the paid product for free.
    const twoYearExpired =
      agent?.billing_interval === 'two_year_prepay' &&
      !!agent?.current_period_end &&
      Date.parse(agent.current_period_end) < Date.now()
    const isPro = ['pro', 'team', 'brokerage'].includes(agentTier) && !twoYearExpired

    // Trial cap check — BEFORE creating the visitor row, so over-quota
    // requests can't pollute the agent's visitor log.
    if (!isPro) {
      const { count } = await supabase
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', openHouse.agent_id)

      if ((count ?? 0) >= TRIAL_LIMIT) {
        return NextResponse.json({
          error: 'This agent has reached their free trial limit. Please ask them to upgrade to Pro at ohaccess.com'
        }, { status: 403 })
      }
    }

    // Has this number opted out of SMS (replied STOP) on any prior open house,
    // for any agent? If so we suppress the code-word text (Twilio would reject
    // it with error 21610 anyway) and flag the visitor. Email still goes out.
    const normalizedPhone = normalizePhone(phone)
    let phoneOptedOut = false
    if (normalizedPhone) {
      const { data: optOut } = await supabase
        .from('sms_opt_outs')
        .select('phone')
        .eq('phone', normalizedPhone)
        .maybeSingle()
      phoneOptedOut = !!optOut
    }

    // Save visitor
    const { data: visitorRow, error: visitorError } = await supabase
      .from('visitors')
      .insert({
        open_house_id: openHouseId,
        agent_id: openHouse.agent_id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        purchasing_timeline: purchasingTimeline,
        sms_opted_out: phoneOptedOut,
        source: 'ohaccess'
      })
      .select('id')
      .single()

    if (visitorError || !visitorRow) {
      return NextResponse.json({ error: 'Failed to save visitor' }, { status: 500 })
    }

    // CRM push via Zapier — best-effort. Only call verified Zapier "Catch Hook"
    // URLs (https://hooks.zapier.com/) to avoid SSRF, and never let a slow or
    // dead webhook delay/break the visitor's registration.
    const zapHook = agent?.zapier_webhook_url
    if (typeof zapHook === 'string' && zapHook.startsWith('https://hooks.zapier.com/')) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 3000)
        await fetch(zapHook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email,
            phone,
            purchasing_timeline: purchasingTimeline,
            registered_at: new Date().toISOString(),
            property_address: openHouse.property_address,
            agent_name: agent?.full_name || '',
            visitor_url: `https://ohaccess.com/visitor/${visitorRow.id}`,
          }),
        })
        clearTimeout(timer)
      } catch { /* best effort — ignore webhook failures */ }
    }

    // Generate short URLs (best-effort — if creation fails we just skip the link)
    let listingShortUrl: string | null = null
    let agentShortUrl: string | null = null

    if (isHttpUrl(openHouse.listing_url)) {
      listingShortUrl = await createShortUrl(
        openHouse.listing_url,
        openHouse.agent_id,
        openHouseId,
        'listing'
      )
    }
    if (isHttpUrl(agent?.landing_page_url)) {
      agentShortUrl = await createShortUrl(
        agent.landing_page_url,
        openHouse.agent_id,
        openHouseId,
        'agent'
      )
    }

    // ① VISITOR SMS — keep under SMS_MAX_LENGTH where possible so Twilio
    // bills 1 segment. The "Reply STOP to opt out" line stays in the base
    // message even if it pushes us to 2 segments for very long addresses —
    // TCPA opt-out signaling is more important than the marginal cost.
    const smsBody = buildSmsBody(
      `Your TEXT entry code for ${streetAddress} is ${smsCodeWord}. Show this text at the door. Reply STOP to opt out.`,
      [
        ...(listingShortUrl ? [{ label: 'Listing', url: listingShortUrl }] : []),
        ...(agentShortUrl ? [{ label: 'Agent', url: agentShortUrl }] : []),
      ]
    )

    // Skip the code-word text for opted-out numbers (they get the email code
    // instead). Sending would just bounce with Twilio error 21610.
    let visitorSms: Awaited<ReturnType<typeof twilioClient.messages.create>> | null = null
    if (!phoneOptedOut) {
      visitorSms = await twilioClient.messages.create({
        body: smsBody,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: phone,
        // Twilio posts delivery updates (delivered/undelivered/failed) here so we
        // can flag bad numbers on the agent dashboard.
        statusCallback: `${APP_URL}/api/webhooks/twilio-status`,
      })
    }

    // ② VISITOR EMAIL — escape every agent-controlled field before
    // interpolating it into the HTML to prevent injection / tracking-pixel abuse.
    const agentName = escapeHtml(agent?.full_name || 'Your Agent')
    const agentBrokerage = escapeHtml(agent?.brokerage || '')
    const agentDisplayEmail = escapeHtml(agent?.display_email || '')
    const agentPhone = escapeHtml(agent?.phone || '')
    const headshotUrl = safeUrl(agent?.headshot_url)

    // Team/brokerage members inherit their team's branding (logo + header
    // color) instead of their individual settings, so every agent's emails
    // look consistent. Falls back to the agent's own branding when they
    // aren't on a team or the team hasn't set those fields.
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
    const headerColor = isHexColor(brandColor) ? brandColor : '#1d1d1f'
    const logoUrl = safeUrl(brandLogo)

    const visitorEmail = await resend.emails.send({
      from: 'ohACCESS <noreply@mail.ohaccess.com>',
      to: email,
      cc: agent?.email ? [agent.email] : [],
      // Replies go to the listing agent (the person a visitor would want to
      // reach), not the send-only noreply subdomain — which has no inbox and
      // hard-bounces any reply.
      replyTo: agent?.display_email || agent?.email || 'support@ohaccess.com',
      subject: `Your ohACCESS email code: ${emailCodeWord}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 20px;">
          <div style="background: ${headerColor}; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
            <div style="font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">Your access code is ready</div>
          </div>
          <div style="background: white; border-radius: 0 0 16px 16px; padding: 24px;">
            <div style="background: #f5f5f7; border: 1px dashed #d1d1d6; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 16px;">
              <div style="font-size: 11px; color: #6e6e73; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">Your Email Access Code</div>
              <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #1d1d1f;"><q>${escapeHtml(emailCodeWord)}</q></div>
              <div style="font-size: 12px; color: #6e6e73; margin-top: 8px;">Share this code with the host at the door to gain access.</div>
              <div style="font-size: 11px; color: #6e6e73; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e5ea;">📱 We also texted you a separate code. If the host asks for your <strong>text code</strong>, check your phone&apos;s messages.</div>
            </div>
            <div style="background: #f5f5f7; border-radius: 10px; padding: 14px; margin-bottom: 16px; font-size: 13px; color: #6e6e73; line-height: 1.8;">
              <strong style="color: #1d1d1f;">${escapeHtml(fullAddress)}</strong><br/>
              📅 ${escapeHtml(openHouse.open_house_date)}<br/>
              🕒 ${escapeHtml(openHouse.open_house_hours)}<br/>
              🛏 ${escapeHtml(openHouse.bedrooms || '—')} bed · 🛁 ${escapeHtml(openHouse.bathrooms || '—')} bath · 📐 ${escapeHtml(openHouse.square_footage || '—')} sq ft <br/>
              💰 ${escapeHtml(openHouse.listing_price || '—')}<br/>
              ${listingShortUrl ? `📝 <a href="${escapeHtml(listingShortUrl)}" style="color: #0071e3; font-weight: 600; font-size: 13px;">Full listing details </a>` : ''}
            </div>
            <div style="background: #f5f5f7; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
              <div style="display: flex; align-items: center;">
                ${headshotUrl ? `<img src="${escapeHtml(headshotUrl)}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid #d1d1d6;margin-right:20px;" />` : ''}
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: #1d1d1f;">${agentName}</div>
                  <div style="font-size: 12px; color: #6e6e73;">${agentBrokerage}</div>
                  ${agentDisplayEmail ? `<div style="font-size: 12px; color: #0071e3;">${agentDisplayEmail}</div>` : ''}
                  ${agentPhone ? `<div style="font-size: 12px; color: #6e6e73;">${agentPhone}</div>` : ''}
                  ${agentShortUrl ? `<div><a href="${escapeHtml(agentShortUrl)}" style="font-size: 12px; color: #0071e3;">Agent information</a></div>` : ''}
                </div>
              </div>
              ${logoUrl ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e5ea; text-align: center;"><img src="${escapeHtml(logoUrl)}" style="max-height:80px;width:80%;object-fit:contain;" /></div>` : ''}
            </div>
            <div style="margin-top: 16px; padding: 12px; background: #f5f5f7; border-radius: 8px; font-size: 11px; color: #6e6e73; text-align: center; line-height: 1.6;">
              By registering you agreed to the ohACCESS <a href="https://ohaccess.com/terms" style="color: #6e6e73;">Terms of Service</a>.<br/>
              You consent to be contacted by the listing agent.<br/>
              Reply STOP to any text to opt out · <a href="https://ohaccess.com/privacy" style="color: #6e6e73;">Privacy Policy</a><br/>
              <em style="color: #6e6e73;">Heads up: opting out blocks access codes for all future ohACCESS open houses.</em>
            </div>
          </div>
        </div>
      `
    })

    // Record the provider message ids so the Resend / Twilio status webhooks
    // can match later delivery events (bounce / undelivered) back to this
    // visitor. Best-effort: a bookkeeping failure must not fail registration.
    const { error: deliveryIdErr } = await supabase
      .from('visitors')
      .update({
        email_message_id: visitorEmail.data?.id ?? null,
        sms_message_sid: visitorSms?.sid ?? null,
      })
      .eq('id', visitorRow.id)
    if (deliveryIdErr) {
      console.error('Failed to store delivery message ids', deliveryIdErr)
    }

    // ③ AGENT SMS ALERT — sent to every agent (paid or within their trial
    // cap). The trial limit is enforced above, so reaching here means the
    // visitor row was allowed; the agent should always be notified.
    // Include a tap-through link to the visitor page where the agent can
    // verify and add notes (best-effort short link).
    if (agent?.phone) {
      let visitorShortUrl: string | null = null
      try {
        visitorShortUrl = await createShortUrl(
          `https://ohaccess.com/visitor/${visitorRow.id}`,
          openHouse.agent_id,
          openHouseId,
          'visitor'
        )
      } catch { /* skip link on failure */ }

      await twilioClient.messages.create({
        body: `ohACCESS Alert: New visitor at ${streetAddress}. ${firstName} ${lastName}, ${phone}, ${email}, Timeline: ${purchasingTimeline}, Time: ${now}${visitorShortUrl ? ` — Verify & add notes: ${visitorShortUrl}` : ''}`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: agent.phone
      })
    }

    // Intentionally do NOT return codeWord — that would defeat the SMS/email
    // verification, since any caller could read it from the response.
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}
