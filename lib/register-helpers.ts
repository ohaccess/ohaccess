import { escapeHtml } from './escape-html'

// Pure helpers for the visitor-registration flow. Kept free of side-effecting
// imports (no Twilio/Resend/Supabase clients) so they can be unit-tested in
// isolation — the register route imports them back in.

// Max characters for a single SMS segment. Optional links are only appended to
// the code-word text while the message still fits inside this budget, so a long
// listing URL can't push the SMS into multi-segment (extra cost) or rejection.
export const SMS_MAX_LENGTH = 160

// Random 8-char alphanumeric slug for a short URL.
export function generateCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Safely append optional URLs without exceeding SMS_MAX_LENGTH. An empty
// label appends the bare URL (saves characters so links fit more addresses).
export function buildSmsBody(base: string, extras: { label: string; url: string }[]): string {
  let body = base
  for (const extra of extras) {
    const candidate = `${body} ${extra.label ? `${extra.label}: ` : ''}${extra.url}`
    if (candidate.length <= SMS_MAX_LENGTH) body = candidate
  }
  return body
}

// Only http(s) URLs are allowed to be forwarded/embedded — blocks javascript:,
// data:, file:, and other schemes (and, for outbound calls, non-web targets).
export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false
  return /^https?:\/\//i.test(value)
}

export function safeUrl(value: string | null | undefined): string {
  return isHttpUrl(value) ? value : ''
}

export function isHexColor(value: string | null | undefined): boolean {
  return !!value && /^#[0-9a-fA-F]{3,8}$/.test(value)
}

export function isEmail(value: string | null | undefined): value is string {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

// Picks who gets the agent's copy of a visitor's code email. A CC is visible
// to the visitor, so the visible copy goes to the agent's public display email
// (falling back to their login email only if no display email is set). The
// login email additionally gets a HIDDEN bcc copy as a safety net — deduped so
// a single address that serves as both isn't emailed twice. Invalid/missing
// addresses are dropped.
export function agentCopyRecipients(
  displayEmail: string | null | undefined,
  loginEmail: string | null | undefined
): { cc: string[]; bcc: string[] } {
  const cc = isEmail(displayEmail)
    ? displayEmail.trim()
    : (isEmail(loginEmail) ? loginEmail.trim() : null)
  const bcc = isEmail(loginEmail) && loginEmail.trim() !== cc ? loginEmail.trim() : null
  return { cc: cc ? [cc] : [], bcc: bcc ? [bcc] : [] }
}

// Builds the lead-notification email we send to an agent's CRM intake address.
// Two layers of coverage:
//   1. A clearly-labeled human-readable body — every CRM email parser (Follow Up
//      Boss, BoldTrail, Lofty, Sierra, Real Geeks, …) is tuned to read "Name:",
//      "Email:", "Phone:" style lead alerts, so this works almost everywhere.
//   2. Lead Metadata Spec v1.0 meta tags (leadmetadata.org) for CRMs that support
//      the real-estate standard and parse structured fields directly.
// All visitor/agent-controlled values are escaped before interpolation.
export function buildCrmLeadEmail(lead: {
  firstName: string
  lastName: string
  email: string
  phone: string
  purchasingTimeline: string
  propertyAddress: string
  agentName: string
  registeredAt: string
  visitorUrl: string
}): string {
  const fullName = `${lead.firstName} ${lead.lastName}`.trim()
  const e = escapeHtml
  return `<!DOCTYPE html>
<html>
<head>
<meta name="lead_information_version" content="1.0" />
<meta name="lead_name" content="${e(fullName)}" />
<meta name="lead_email" content="${e(lead.email)}" />
<meta name="lead_phone" content="${e(lead.phone)}" />
<meta name="lead_source" content="ohACCESS" />
<meta name="lead_message" content="Open-house sign-in. Purchasing timeline: ${e(lead.purchasingTimeline || 'Not specified')}." />
<meta name="lead_property_address" content="${e(lead.propertyAddress)}" />
</head>
<body>
<p>New lead from an ohACCESS open-house sign-in.</p>
<p>
Name: ${e(fullName)}<br/>
Email: ${e(lead.email)}<br/>
Phone: ${e(lead.phone)}<br/>
Purchasing Timeline: ${e(lead.purchasingTimeline || 'Not specified')}<br/>
Property: ${e(lead.propertyAddress)}<br/>
Listing Agent: ${e(lead.agentName)}<br/>
Source: ohACCESS<br/>
Registered: ${e(lead.registeredAt)}
</p>
<p>Visitor details: <a href="${e(lead.visitorUrl)}">${e(lead.visitorUrl)}</a></p>
</body>
</html>`
}
