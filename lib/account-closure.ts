import { escapeHtml } from '@/lib/escape-html'
import { ohaccessEmail, ohaccessButton, OHACCESS_BRAND } from '@/lib/email-shell'
import { isExpiredPrepaidAccess, isLegacyTwoYear, isComped } from '@/lib/billing-plans'

// Self-serve account closure (Dave, 2026-09-26). An agent who has paid for
// a period they're still inside keeps what they paid for: the account closes
// itself the day that period ends, and any recurring subscription is set to
// stop renewing so they're never charged again. Everyone else (free trial,
// team members covered by someone else's plan, sponsor-covered agents,
// lapsed prepays) is deleted on the spot. Pure so the Settings panel can
// show the right message BEFORE the agent confirms, and the API can never
// disagree with it.

export type ClosureProfile = {
  tier?: string | null
  billing_interval?: string | null
  stripe_subscription_id?: string | null
  current_period_end?: string | null
  subscription_canceled_at?: string | null
}

export type ClosureDecision =
  | { mode: 'now' }
  | { mode: 'scheduled'; at: string; cancelStripe: boolean }

export function decideAccountClosure(p: ClosureProfile | null | undefined, nowMs = Date.now()): ClosureDecision {
  if (!p) return { mode: 'now' }
  const paidTier = ['pro', 'team', 'brokerage'].includes(p.tier || 'free')
  const endMs = p.current_period_end ? Date.parse(p.current_period_end) : NaN
  const insidePaidPeriod = paidTier && !isExpiredPrepaidAccess(p) && Number.isFinite(endMs) && endMs > nowMs
  // Team members read tier='team' but the SUBSCRIPTION is the team lead's:
  // they have no Stripe id and no legacy/comped window of their own, so
  // there is nothing they paid for to run out. Same for sponsor coverage.
  const ownsThePayment = !!p.stripe_subscription_id || isLegacyTwoYear(p) || isComped(p)
  if (!insidePaidPeriod || !ownsThePayment) return { mode: 'now' }
  return {
    mode: 'scheduled',
    at: new Date(endMs).toISOString(),
    // A pending cancel (subscription_canceled_at) already stops renewal.
    cancelStripe: !!p.stripe_subscription_id && !p.subscription_canceled_at,
  }
}

export function formatClosureDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

// The confirmation email. Immediate closures get "has been closed"; scheduled
// ones get the date plus how to change their mind (the dashboard banner's
// Keep-my-account button, which stays until the day arrives).
export function buildAccountClosureEmail(o: {
  firstName?: string | null
  decision: ClosureDecision
  appUrl: string
}): { subject: string; html: string } {
  const e = escapeHtml
  const greeting = o.firstName?.trim() ? `Hi ${e(o.firstName.trim())},` : 'Hi there,'
  const gold = OHACCESS_BRAND.accent
  const label = (t: string) =>
    `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${gold};margin:24px 0 6px;">${t}</div>`
  const p = (t: string) => `<p style="font-size:14px;line-height:1.7;margin:12px 0 0;">${t}</p>`

  if (o.decision.mode === 'now') {
    return {
      subject: 'Your ohACCESS account has been closed',
      html: ohaccessEmail({
        headerSubHtml: 'Account closed',
        bodyHtml: `
          <div style="font-size:14px;line-height:1.7;">${greeting}</div>
          ${p('As you asked, your ohACCESS account has been closed and your login no longer works.')}
          ${label('What was removed')}
          ${p('Your profile, branding, open houses, QR codes, and visitor log have been deleted from your account.')}
          ${label('What we keep, and why')}
          ${p('An archived copy of each visitor registration is kept for up to 3 years from the date it was collected, as described in our <a href="' + e(o.appUrl + '/privacy') + '" style="color:' + gold + ';font-weight:700;">Privacy Policy</a>. That record exists so there is always an answer to who was inside a home, and it is not used for anything else.')}
          ${p('If this was a mistake, you are welcome to create a new account any time. Your old data cannot be restored.')}
        `,
        footerHtml: 'You are receiving this because an ohACCESS account with this email address was closed. Questions? Reply to this email.',
      }),
    }
  }

  const when = e(formatClosureDate(o.decision.at))
  return {
    subject: `Your ohACCESS account will close on ${formatClosureDate(o.decision.at)}`,
    html: ohaccessEmail({
      headerSubHtml: 'Account closing',
      bodyHtml: `
        <div style="font-size:14px;line-height:1.7;">${greeting}</div>
        ${p(`As you asked, your ohACCESS account is set to close on <strong>${when}</strong>. That is the end of the period you have already paid for, so you keep full access until then and you will not be charged again.`)}
        ${label('What happens on that day')}
        ${p('Your profile, branding, open houses, QR codes, and visitor log will be deleted from your account, and your login will stop working. An archived copy of each visitor registration is kept for up to 3 years from the date it was collected, as described in our <a href="' + e(o.appUrl + '/privacy') + '" style="color:' + gold + ';font-weight:700;">Privacy Policy</a>.')}
        ${label('Changed your mind?')}
        ${p('Open your dashboard any time before then and click <strong>Keep my account</strong>. Export your visitor log first if you would like a copy.')}
        <div style="margin-top:20px;">${ohaccessButton('Open my dashboard →', e(o.appUrl + '/dashboard'))}</div>
      `,
      footerHtml: 'You are receiving this because you asked to close your ohACCESS account. Questions? Reply to this email.',
    }),
  }
}
