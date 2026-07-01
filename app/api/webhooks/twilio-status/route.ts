import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { normalizePhone } from '@/lib/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'
const CALLBACK_URL = `${APP_URL}/api/webhooks/twilio-status`

// Twilio posts SMS delivery updates as form-encoded data and signs them with
// X-Twilio-Signature (HMAC over the exact callback URL + sorted params).
export async function POST(request: Request) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) params[k] = String(v)

  const signature = request.headers.get('x-twilio-signature') || ''
  if (AUTH_TOKEN) {
    const valid = twilio.validateRequest(AUTH_TOKEN, signature, CALLBACK_URL, params)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }
  } else {
    console.warn('TWILIO_AUTH_TOKEN not set — skipping signature check')
  }

  const sid = params.MessageSid
  const status = params.MessageStatus // queued | sent | delivered | undelivered | failed
  if (!sid || !status) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  // Failures (undelivered/failed) are terminal — record unconditionally. Other
  // statuses (queued/sent/delivered) only apply as the FIRST event (status
  // still null), so an out-of-order intermediate callback can't overwrite a
  // recorded failure.
  const isFailure = status === 'undelivered' || status === 'failed'
  let query = supabase
    .from('visitors')
    .update({ sms_status: status, delivery_updated_at: new Date().toISOString() })
    .eq('sms_message_sid', sid)
  if (!isFailure) query = query.is('sms_status', null)
  const { error } = await query
  if (error) {
    console.error('Twilio status webhook: failed to update visitor', error)
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
  }

  // Error 21610 = the recipient has opted out (replied STOP). Record the number
  // in the global suppression list and flag this visitor as opted out. Future
  // registrations of this number (any agent) are then suppressed at send time.
  if (params.ErrorCode === '21610') {
    const phone = normalizePhone(params.To)
    if (phone) {
      await supabase
        .from('sms_opt_outs')
        .upsert({ phone, source: 'twilio_error_21610' }, { onConflict: 'phone' })
    }
    await supabase.from('visitors').update({ sms_opted_out: true }).eq('sms_message_sid', sid)
  }

  return NextResponse.json({ ok: true })
}
