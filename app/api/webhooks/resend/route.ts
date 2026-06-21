import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET

// Resend signs webhooks with Svix. Verify the signature manually (no extra
// dependency): the signed payload is `${id}.${timestamp}.${body}`, HMAC-SHA256
// with the base64-decoded secret (the part after the `whsec_` prefix).
function verifySvix(body: string, headers: Headers): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('RESEND_WEBHOOK_SECRET not set — skipping signature check')
    return true
  }
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signatureHeader = headers.get('svix-signature')
  if (!id || !timestamp || !signatureHeader) return false

  const secretBytes = Buffer.from(WEBHOOK_SECRET.replace(/^whsec_/, ''), 'base64')
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64')

  // Header is a space-separated list of `v1,<signature>` entries.
  return signatureHeader.split(' ').some((part) => {
    const sig = part.split(',')[1]
    if (!sig || sig.length !== expected.length) return false
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  })
}

// Map Resend event types to the status we store. Transient events
// (delivery_delayed, etc.) are ignored to avoid dashboard noise.
const STATUS_BY_EVENT: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
}

export async function POST(request: Request) {
  const body = await request.text()
  if (!verifySvix(body, request.headers)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: { type?: string; data?: { email_id?: string } }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const status = event.type ? STATUS_BY_EVENT[event.type] : undefined
  const emailId = event.data?.email_id
  if (!status || !emailId) {
    // Unhandled event type or missing id — acknowledge so Resend stops retrying.
    return NextResponse.json({ ok: true, ignored: true })
  }

  const { error } = await supabase
    .from('visitors')
    .update({ email_status: status, delivery_updated_at: new Date().toISOString() })
    .eq('email_message_id', emailId)
  if (error) {
    console.error('Resend webhook: failed to update visitor', error)
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
