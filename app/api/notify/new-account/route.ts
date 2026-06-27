import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { notifyAdmins } from '@/lib/notify-admin'
import { escapeHtml } from '@/lib/escape-html'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Emails the ohACCESS team the first time a freshly-created account becomes
// active (first authenticated dashboard load). The dashboard calls this on
// load; it's safe to call repeatedly because we claim a per-account flag with
// a conditional UPDATE — only the first call that flips signup_admin_notified_at
// from NULL actually sends, so the team gets exactly one email per account.
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Atomically claim the notification. If no row comes back, it was already
  // sent (or no profile yet) and we stop here.
  const { data: claimed, error } = await supabase
    .from('profiles')
    .update({ signup_admin_notified_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('signup_admin_notified_at', null)
    .select('email, referral_source')
    .maybeSingle()

  if (error) {
    console.error('new-account notify: claim failed', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
  if (!claimed) {
    // Already notified for this account — nothing to do.
    return NextResponse.json({ ok: true, sent: false })
  }

  const email = claimed.email || user.email || '(unknown email)'
  const referral = (claimed.referral_source || '').trim()

  const sent = await notifyAdmins(
    `🎉 New ohACCESS account: ${email}`,
    `<p>A new account just became active on ohACCESS.</p>
     <p><strong>Email:</strong> ${escapeHtml(email)}<br/>
     <strong>Heard about us:</strong> ${escapeHtml(referral || '—')}</p>`
  )

  return NextResponse.json({ ok: true, sent })
}
