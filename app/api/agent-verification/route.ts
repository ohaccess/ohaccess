import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { normalizePhone, phoneError, storablePhone } from '@/lib/phone'
import { normalizeCountry, inferProfileCountry } from '@/lib/regions'
import { twilioSender } from '@/lib/register-helpers'
import {
  preferredCodewordChannel,
  whatsAppConfigured,
  whatsAppTemplateKind,
  isWhatsAppFallbackError,
  whatsAppAddress,
  type CodewordChannel,
} from '@/lib/messaging-channel'
import {
  VERIFY_CODE_TTL_MINUTES,
  VERIFY_MAX_ATTEMPTS,
  VERIFY_SENDS_PER_HOUR,
  verificationSmsBody,
  lineTypeProblem,
  licenceError,
  licenceRequirement,
} from '@/lib/agent-verification'
import { generateVerificationCode, hashVerificationCode, verificationCodeMatches } from '@/lib/agent-verification-codes'

// POST /api/agent-verification
//   { action: 'send', phone, country }      text (or WhatsApp) a 6-digit code
//   { action: 'confirm', code, country, licenseNumber?, licenseState? }
// See lib/agent-verification.ts for the why; migration 051 for enforcement.

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) return fail('Please sign in again.', 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('Invalid request.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, phone, country, state, agent_verified_at')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError || !profile) return fail('We couldn’t load your account. Please try again.', 500)
  if (profile.agent_verified_at) return NextResponse.json({ verified: true })

  const country = normalizeCountry(typeof body.country === 'string' ? body.country : null) ?? inferProfileCountry(profile)

  if (body.action === 'send') return sendCode(req, user.id, body, country)
  if (body.action === 'confirm') return confirmCode(user.id, body, country, profile)
  return fail('Invalid request.')
}

async function sendCode(req: Request, userId: string, body: Record<string, unknown>, country: string) {
  const rawPhone = typeof body.phone === 'string' ? body.phone : ''
  const phoneProblem = phoneError(rawPhone, country)
  if (phoneProblem) return fail(phoneProblem)
  const e164 = normalizePhone(rawPhone, country)
  if (!e164) return fail('Please enter a valid mobile number.')

  const perUser = await checkRateLimit(userId, 'agent-verify-send', VERIFY_SENDS_PER_HOUR, 3600)
  if (!perUser.allowed) return fail('Too many codes requested. Please wait an hour and try again.', 429)
  const perIp = await checkRateLimit(getClientIp(req), 'agent-verify-send-ip', 20, 86400)
  if (!perIp.allowed) return fail('Too many codes requested. Please try again tomorrow.', 429)

  const { data: taken } = await supabase
    .from('profiles')
    .select('id')
    .eq('verified_phone', e164)
    .neq('id', userId)
    .limit(1)
  if (taken && taken.length > 0) {
    return fail('That number is already verified on another ohACCESS account. Use a different mobile number, or contact support@ohaccess.com.')
  }

  // Refuse app/internet numbers and landlines before paying for a text.
  // Best-effort with a 3s cap: a failed lookup still lets the code go out.
  let lineType: string | null = null
  try {
    const lookup = await Promise.race([
      twilioClient.lookups.v2.phoneNumbers(e164).fetch({ fields: 'line_type_intelligence' }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('lookup timeout')), 3000)),
    ])
    lineType = lookup.lineTypeIntelligence?.type ?? null
  } catch (err) {
    console.error('Agent verification lookup failed:', err)
  }
  const lineProblem = lineTypeProblem(lineType)
  if (lineProblem) return fail(lineProblem)

  const code = generateVerificationCode()
  const { error: storeError } = await supabase.from('agent_phone_codes').upsert({
    user_id: userId,
    phone_e164: e164,
    code_hash: hashVerificationCode(code, userId),
    line_type: lineType,
    attempts: 0,
    expires_at: new Date(Date.now() + VERIFY_CODE_TTL_MINUTES * 60_000).toISOString(),
    created_at: new Date().toISOString(),
  })
  if (storeError) {
    console.error('Agent verification store failed:', storeError)
    return fail('Something went wrong. Please try again.', 500)
  }

  // WhatsApp only with the approved Authentication template ("{{1}} is your
  // verification code"); the visitor link/word templates carry other text.
  const whatsAppReady = whatsAppConfigured() && whatsAppTemplateKind() === 'auth'
  const sendSms = () => twilioClient.messages.create({ body: verificationSmsBody(code), ...twilioSender(), to: e164 })
  const sendWhatsApp = () =>
    twilioClient.messages.create({
      from: whatsAppAddress(process.env.TWILIO_WHATSAPP_FROM!),
      to: whatsAppAddress(e164),
      contentSid: process.env.TWILIO_WHATSAPP_CODEWORD_CONTENT_SID!,
      contentVariables: JSON.stringify({ 1: code }),
    })

  let channel: CodewordChannel
  try {
    if (preferredCodewordChannel(country, whatsAppReady) === 'whatsapp') {
      try {
        await sendWhatsApp()
        channel = 'whatsapp'
      } catch {
        await sendSms()
        channel = 'sms'
      }
    } else {
      try {
        await sendSms()
        channel = 'sms'
      } catch (err) {
        if (!whatsAppReady || !isWhatsAppFallbackError(err)) throw err
        await sendWhatsApp()
        channel = 'whatsapp'
      }
    }
  } catch (err) {
    console.error('Agent verification send failed:', err)
    await supabase.from('agent_phone_codes').delete().eq('user_id', userId)
    const twilioCode = (err as { code?: unknown })?.code
    if (twilioCode === 21610) return fail('That number has texts from ohACCESS turned off. Reply START to our last text, then try again.')
    return fail('We couldn’t send a text to that number. Please check it and try again.')
  }

  await supabase.from('agent_phone_codes').update({ channel }).eq('user_id', userId)
  return NextResponse.json({ sent: true, channel })
}

async function confirmCode(
  userId: string,
  body: Record<string, unknown>,
  country: string,
  profile: { phone: string | null }
) {
  const licenseNumber = typeof body.licenseNumber === 'string' ? body.licenseNumber.trim() : ''
  const licenseState = typeof body.licenseState === 'string' ? body.licenseState.trim().toUpperCase() : ''
  const licenceProblem = licenceError(country, licenseNumber, licenseState)
  if (licenceProblem) return fail(licenceProblem)

  const { data: pending } = await supabase
    .from('agent_phone_codes')
    .select('phone_e164, code_hash, line_type, attempts, expires_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (!pending) return fail('Please request a code first.')
  if (new Date(pending.expires_at).getTime() < Date.now()) {
    return fail('That code has expired. Tap “Send a new code” and try again.')
  }
  if (pending.attempts >= VERIFY_MAX_ATTEMPTS) {
    return fail('Too many wrong tries. Tap “Send a new code” to get a fresh one.')
  }

  const code = typeof body.code === 'string' ? body.code : ''
  if (!verificationCodeMatches(code, userId, pending.code_hash)) {
    await supabase.from('agent_phone_codes').update({ attempts: pending.attempts + 1 }).eq('user_id', userId)
    const left = VERIFY_MAX_ATTEMPTS - pending.attempts - 1
    return fail(left > 0 ? `That code isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'That code isn’t right. Tap “Send a new code” to get a fresh one.')
  }

  const requirement = licenceRequirement(country)
  const verifiedAt = new Date().toISOString()
  const update: Record<string, unknown> = {
    agent_verified_at: verifiedAt,
    verified_phone: pending.phone_e164,
    verified_phone_line_type: pending.line_type,
    country,
  }
  if (requirement) {
    update.license_number = licenseNumber
    if (requirement.regionLabel && requirement.regions) update.state = licenseState
  }
  // Their verified mobile becomes the new-visitor alert number unless they
  // already set one in Settings.
  if (!(profile.phone || '').trim()) update.phone = storablePhone(pending.phone_e164, country)

  const { data: saved, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select('agent_verified_at, verified_phone, country, license_number, state, phone')
    .single()
  if (error) {
    if (error.code === '23505') {
      return fail('That number is already verified on another ohACCESS account. Use a different mobile number, or contact support@ohaccess.com.')
    }
    console.error('Agent verification save failed:', error)
    return fail('Something went wrong. Please try again.', 500)
  }

  await supabase.from('agent_phone_codes').delete().eq('user_id', userId)
  return NextResponse.json({ verified: true, profile: saved })
}
