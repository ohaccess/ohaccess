import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { notifyAdmins } from '@/lib/notify-admin'
import { escapeHtml } from '@/lib/escape-html'
import { buildWelcomeEmail, welcomeFirstName } from '@/lib/welcome-email'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The first authenticated dashboard load of a fresh account triggers two
// one-time emails: a heads-up to the ohACCESS team, and the getting-started
// (welcome) email to the agent. The dashboard calls this on every load; each
// send claims its own per-account flag with a conditional UPDATE — only the
// call that flips the column from NULL sends — so both are at-most-once no
// matter how often this runs. The claims are independent: a failure or an
// already-set flag on one never blocks the other.
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request)
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
    .select('email, full_name')
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
