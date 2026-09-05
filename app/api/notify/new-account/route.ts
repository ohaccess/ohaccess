import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/auth'
import { notifyAdmins } from '@/lib/notify-admin'
import { escapeHtml } from '@/lib/escape-html'
import { buildWelcomeEmail, welcomeFirstName } from '@/lib/welcome-email'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Two one-time emails for a fresh account: a heads-up to the ohACCESS team,
// and the getting-started (welcome) email to the agent. Each send claims its
// own per-account flag with a conditional UPDATE — only the call that flips
// the column from NULL sends — so both are at-most-once no matter how often
// or from where this runs.
//
// Two callers share this endpoint:
//   1. The DB trigger (migration 046) the moment Supabase confirms the
//      agent's email — CRON_SECRET bearer + {userId} body. This is the
//      primary path: the email lands at confirmation click, before the
//      agent ever signs in.
//   2. The dashboard on every authenticated load (user bearer token) — now
//      the fallback that also covers OAuth signups, which are confirmed at
//      creation and never fire the UPDATE trigger.
export async function POST(request: Request) {
  let user: User | null = null

  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    const body = await request.json().catch(() => null)
    const userId = body?.userId
    if (typeof userId !== 'string' || !UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }
    const { data, error } = await supabase.auth.admin.getUserById(userId)
    if (error || !data?.user) {
      return NextResponse.json({ error: 'Unknown user' }, { status: 404 })
    }
    // The trigger only fires on confirmation, but guard anyway so a
    // hand-crafted call can't send ahead of it.
    if (!data.user.email_confirmed_at) {
      return NextResponse.json({ ok: true, skipped: 'unconfirmed' })
    }
    user = data.user

    // At confirmation time the profile row usually doesn't exist yet (the
    // dashboard creates it on first load), and the claim UPDATEs below need
    // a row to flip. Mirrors the dashboard's auto-create: referral source
    // from auth metadata (stashed at signup, survives the confirmation hop).
    const metaRef =
      (user.user_metadata?.referral_source as string | undefined) || null
    const insertRow: Record<string, unknown> = { id: user.id, email: user.email }
    if (metaRef) {
      insertRow.referral_source = metaRef
      insertRow.referral_source_first_seen_at = new Date().toISOString()
    }
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(insertRow, { onConflict: 'id', ignoreDuplicates: true })
    if (profileError) {
      console.error('new-account notify: profile ensure failed', profileError)
    }
  } else {
    user = await getAuthenticatedUser(request)
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Internal new-account heads-up to the team ─────────────────────────
  let adminNotified = false
  const { data: claimed, error: claimError } = await supabase
    .from('profiles')
    .update({ signup_admin_notified_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('signup_admin_notified_at', null)
    .select('email, referral_source')
    .maybeSingle()

  if (claimError) {
    console.error('new-account notify: claim failed', claimError)
  } else if (claimed) {
    const email = claimed.email || user.email || '(unknown email)'
    const referral = (claimed.referral_source || '').trim()
    adminNotified = await notifyAdmins(
      `🎉 New ohACCESS account: ${email}`,
      `<p>A new account just became active on ohACCESS.</p>
       <p><strong>Email:</strong> ${escapeHtml(email)}<br/>
       <strong>Heard about us:</strong> ${escapeHtml(referral || '—')}</p>`
    )
  }

  // ── 2. Getting-started email to the agent ────────────────────────────────
  // Existing accounts were backfilled by migration 045, so only accounts
  // created after it ship ever hold a NULL flag here.
  let welcomeSent = false
  const { data: welcome, error: welcomeError } = await supabase
    .from('profiles')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('welcome_email_sent_at', null)
    .select('email, full_name, drip_unsubscribe_token')
    .maybeSingle()

  if (welcomeError) {
    console.error('welcome email: claim failed', welcomeError)
  } else if (welcome) {
    const to = welcome.email || user.email
    if (to) {
      const firstName = welcomeFirstName(welcome.full_name, user.user_metadata)
      const { subject, html } = buildWelcomeEmail({ firstName, appUrl: APP_URL })
      try {
        await resend.emails.send({
          // hello@ lives on the verified send-only subdomain; replies route to
          // a monitored inbox instead of bouncing.
          from: 'ohACCESS <hello@mail.ohaccess.com>',
          to,
          replyTo: 'support@ohaccess.com',
          subject,
          html,
          // Mailbox providers favor mail that offers a way out; an unsubscribe
          // link in the client also absorbs clicks that would otherwise hit
          // "Report spam". The one-click target opts the agent out of drip
          // mail (migration 050); the mailto stays as the fallback.
          headers: {
            'List-Unsubscribe': welcome.drip_unsubscribe_token
              ? `<${APP_URL}/api/unsubscribe?agent=${welcome.drip_unsubscribe_token}>, <mailto:support@ohaccess.com?subject=Unsubscribe>`
              : '<mailto:support@ohaccess.com?subject=Unsubscribe>',
            ...(welcome.drip_unsubscribe_token
              ? { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
              : {}),
          },
        })
        welcomeSent = true
      } catch (e) {
        // Best-effort, consistent with the claim-first pattern above: a mail
        // hiccup costs this one send rather than risking a double-send later.
        console.error('welcome email: send failed', to, e)
      }
    }
  }

  return NextResponse.json({ ok: true, adminNotified, welcomeSent })
}
