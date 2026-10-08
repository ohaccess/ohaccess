// Addresses we must stop mailing: hard bounces and spam complaints reported
// by Resend's webhook for ANY ohACCESS email (migration 060). Distinct from
// email_opt_outs (people who asked to be unsubscribed): these are addresses
// the mailbox provider has told us are dead or hostile, and sending to them
// again only costs sender reputation.
import { supabaseAdmin } from '@/lib/supabase-admin'

export type SuppressionReason = 'bounced' | 'complained'

const PAGE = 1000

export function normalizeEmail(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

// Every suppressed address, lowercased, for the batch senders to check
// against in memory (same shape as their email_opt_outs set).
export async function loadSuppressedEmails(): Promise<Set<string>> {
  const out = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('email_suppressions')
      .select('email')
      .order('email')
      .range(from, from + PAGE - 1)
    if (error) {
      // Fail open: a lookup error must not stop a batch send; the table may
      // also simply not exist yet before migration 060 runs.
      console.error('[email-suppressions] load failed', error)
      return out
    }
    for (const r of data ?? []) out.add(normalizeEmail(r.email))
    if (!data || data.length < PAGE) return out
  }
}

// One address, for the single-send paths (the visitor codeword email).
export async function isEmailSuppressed(email: string | null | undefined): Promise<boolean> {
  const key = normalizeEmail(email)
  if (!key) return false
  const { data, error } = await supabaseAdmin
    .from('email_suppressions')
    .select('email')
    .eq('email', key)
    .maybeSingle()
  if (error) {
    console.error('[email-suppressions] lookup failed', error)
    return false
  }
  return !!data
}

// Records addresses from a Resend bounce/complaint event. First reason wins
// (a later complaint on an already-bounced address changes nothing useful).
export async function recordSuppressions(emails: string[], reason: SuppressionReason, source: string): Promise<void> {
  const rows = [...new Set(emails.map(normalizeEmail).filter((e) => e.includes('@')))].map((email) => ({
    email,
    reason,
    source,
  }))
  if (rows.length === 0) return
  const { error } = await supabaseAdmin
    .from('email_suppressions')
    .upsert(rows, { onConflict: 'email', ignoreDuplicates: true })
  if (error) console.error('[email-suppressions] record failed', error)
}

// Pure helpers over the Resend webhook payload, so the decision is testable.
export type ResendEventData = {
  email_id?: string
  to?: string | string[]
  bounce?: { type?: string; subType?: string } | null
}

export function recipientsFromResendEvent(data: ResendEventData | undefined): string[] {
  const to = data?.to
  if (Array.isArray(to)) return to.filter((t): t is string => typeof t === 'string')
  return typeof to === 'string' ? [to] : []
}

// Which suppression a Resend event calls for, if any. Complaints always
// count. Bounces count unless Resend classifies them as transient (mailbox
// full, greylisting): those addresses are alive and may well take the next
// message.
export function suppressionReasonForEvent(eventType: string | undefined, data: ResendEventData | undefined): SuppressionReason | null {
  if (eventType === 'email.complained') return 'complained'
  if (eventType !== 'email.bounced') return null
  const type = (data?.bounce?.type || '').toLowerCase()
  if (type === 'transient') return null
  return 'bounced'
}
