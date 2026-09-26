import { Resend } from 'resend'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { escapeHtml } from '@/lib/escape-html'
import { ohaccessEmail, ohaccessButton, OHACCESS_BRAND } from '@/lib/email-shell'
import { agentHasPaidAccess } from '@/lib/trial-cap'
import { trialLimitFor } from '@/lib/billing-plans'

// The "you've been removed" email (Privacy Policy §3A promises it): sent when
// a team/brokerage admin removes an agent, when a team's subscription ends
// and its members are cut loose, or when a sponsor ends an agent's
// sponsorship. The agent keeps their account and data; what changes is who
// pays. So the email says exactly where they now stand: their own paid plan
// carries on untouched, or they are back on the free trial with N of the
// free registrations left, or they are already past the cap and need to
// choose a plan before anything else works.

export type RemovalKind = 'team' | 'sponsor'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

export function buildRemovalEmail(o: {
  firstName?: string | null
  kind: RemovalKind
  groupName: string
  visitorsUsed: number
  trialLimit: number
  hasOwnPaidAccess: boolean
  appUrl: string
}): { subject: string; html: string } {
  const e = escapeHtml
  const group = e(o.groupName.trim() || (o.kind === 'team' ? 'your team' : 'your sponsor'))
  const greeting = o.firstName?.trim() ? `Hi ${e(o.firstName.trim())},` : 'Hi there,'
  const dashboardUrl = `${o.appUrl}/dashboard`
  const plansUrl = `${o.appUrl}/dashboard?view=settings`
  const remaining = Math.max(0, o.trialLimit - o.visitorsUsed)

  const subject =
    o.kind === 'team'
      ? `You've been removed from ${o.groupName.trim() || 'your team'} on ohACCESS`
      : `${o.groupName.trim() || 'Your sponsor'} is no longer sponsoring your ohACCESS account`

  const lead =
    o.kind === 'team'
      ? `<strong>${group}</strong> has removed you from its ohACCESS team. Your open houses now use your own branding instead of the team's.`
      : `<strong>${group}</strong> has ended its sponsorship of your ohACCESS account. New visitor registrations will no longer be shared with them.`

  const keep = `Your account, open houses, and visitor records are all still yours. Nothing has been deleted.`

  let status: string
  let button: string
  if (o.hasOwnPaidAccess) {
    status = `Your own subscription keeps everything running exactly as before. Nothing else changes.`
    button = ohaccessButton('Open my dashboard →', e(dashboardUrl))
  } else if (remaining > 0) {
    status = `Your account is now on the free trial. You've used <strong>${o.visitorsUsed} of ${o.trialLimit}</strong> free visitor registrations, so you have <strong>${remaining}</strong> left. Keep hosting: when you reach the limit, choose a plan to keep going without interruption.`
    button = ohaccessButton('Open my dashboard →', e(dashboardUrl)) +
      `<p style="font-size:13px;margin-top:14px;"><a href="${e(plansUrl)}" style="color:${OHACCESS_BRAND.accent};font-weight:700;">See plans</a></p>`
  } else {
    status = `Your account is now on the free trial, and you've already used all <strong>${o.trialLimit}</strong> free visitor registrations. Creating open houses, QR codes, and new sign-ins are paused until you choose a plan. Your data is safe.`
    button = ohaccessButton('Choose a plan →', e(plansUrl))
  }

  const html = ohaccessEmail({
    headerSubHtml: o.kind === 'team' ? 'A change to your team' : 'A change to your sponsorship',
    bodyHtml: `
      <div style="font-size:14px;line-height:1.7;">${greeting}</div>
      <p style="font-size:14px;line-height:1.7;margin:12px 0 0;">${lead}</p>
      <p style="font-size:14px;line-height:1.7;margin:12px 0 0;">${keep}</p>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${OHACCESS_BRAND.accent};margin:24px 0 6px;">What happens next</div>
      <p style="font-size:14px;line-height:1.7;margin:0 0 20px;">${status}</p>
      ${button}
    `,
    footerHtml: `You're receiving this because your ohACCESS account was ${o.kind === 'team' ? 'removed from' : 'unlinked from'} ${group}. Questions? Reply to this email.`,
  })

  return { subject, html }
}

// Look the agent up AFTER the unlink has been written, so the free-trial
// maths reflects what they actually have now. Never throws: a failed email
// must not undo or fail the removal itself.
export async function sendRemovalEmail(agentId: string, kind: RemovalKind, groupName: string): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, tier, sponsor_id, bonus_visitors, billing_interval, stripe_subscription_id, current_period_end')
      .eq('id', agentId)
      .maybeSingle()
    if (!profile?.email) return

    const [hasOwnPaidAccess, { count }] = await Promise.all([
      agentHasPaidAccess(supabase, profile),
      supabase.from('visitors').select('id', { count: 'exact', head: true }).eq('agent_id', agentId),
    ])

    const { subject, html } = buildRemovalEmail({
      firstName: String(profile.full_name || '').trim().split(/\s+/)[0],
      kind,
      groupName,
      visitorsUsed: count || 0,
      trialLimit: trialLimitFor(profile),
      hasOwnPaidAccess,
      appUrl: APP_URL,
    })

    const resend = new Resend(process.env.RESEND_API_KEY!)
    await resend.emails.send({
      from: 'ohACCESS <noreply@mail.ohaccess.com>',
      to: profile.email,
      replyTo: 'support@ohaccess.com',
      subject,
      html,
    })
    console.log(`[REMOVAL-EMAIL] ${kind} removal sent to ${profile.email} (${groupName})`)
  } catch (e) {
    console.error(`[REMOVAL-EMAIL] send failed for ${agentId}`, e)
  }
}
