import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

// Where new-account / new-subscription heads-ups land. Defaults to the
// support alias; override with NOTIFY_EMAILS (comma-separated) if it should
// go elsewhere or to several people.
const DEFAULT_NOTIFY_EMAILS = 'support@ohaccess.com'

/**
 * Send an internal heads-up to the team. Best-effort: never throws, so a mail
 * hiccup can't break the calling request or cause Stripe to retry a webhook.
 * Returns true if an email was dispatched.
 */
export async function notifyAdmins(subject: string, html: string): Promise<boolean> {
  const admins = (process.env.NOTIFY_EMAILS || DEFAULT_NOTIFY_EMAILS)
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
  if (admins.length === 0) {
    console.warn('notifyAdmins: no recipients configured, skipping', subject)
    return false
  }
  try {
    await resend.emails.send({
      from: 'ohACCESS <noreply@mail.ohaccess.com>',
      to: admins,
      subject,
      html,
    })
    return true
  } catch (e) {
    console.error('notifyAdmins failed', subject, e)
    return false
  }
}
