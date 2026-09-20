import { isHexColor, safeUrl } from './register-helpers'
import { onColor, readableOnLight } from './colors'

// The one layout every agent-branded email uses, visitor-facing (codeword,
// thank-you, invite, signed-agreement copy) and agent-facing (reminder,
// report, expired-link lead), so they all read as the same product:
//
//   primary  → the header band (and the fallback avatar / brokerage name)
//   accent   → filled buttons, section labels, links
//   cards    → agent card, then the "Sponsored by" card, each with its logo
//              BELOW the tinted card (lib/email-cards)
//   footer   → why-you-got-this line, then "Powered by ohACCESS"
//
// Table layout, since Gmail and Outlook drop flexbox. Build new branded
// emails from these pieces rather than hand-rolling a wrapper.

export type EmailBrand = {
  primary: string    // validated hex
  accent: string     // validated hex
  onPrimary: string  // readable text on `primary`
  onAccent: string   // readable text on `accent`
  logoUrl: string | null
}

type Row = { primary_color?: string | null; accent_color?: string | null; logo_url?: string | null }

// Brokerage-over-agent branding (team settings mirror colors onto member
// profiles; the brokerage row is the extra guard). Unset or invalid colors
// fall back to the ohACCESS defaults.
export function resolveEmailBranding(agent: Row | null | undefined, brokerage: Row | null | undefined): EmailBrand {
  const primaryRaw = brokerage?.primary_color || agent?.primary_color
  const accentRaw = agent?.accent_color || brokerage?.accent_color
  const primary = primaryRaw && isHexColor(primaryRaw) ? primaryRaw : '#1d1d1f'
  const accent = accentRaw && isHexColor(accentRaw) ? accentRaw : '#0071e3'
  const logoUrl = safeUrl(brokerage?.logo_url || agent?.logo_url) || null
  return { primary, accent, onPrimary: onColor(primary), onAccent: onColor(accent), logoUrl }
}

// ohACCESS speaking in its own voice (welcome, tips, billing, invitations):
// the same layout and the same rule, in the ohACCESS colors. Black header,
// gold buttons / labels / links, dark text on the gold.
export const OHACCESS_BRAND: EmailBrand = {
  primary: '#1d1d1f', accent: '#c9963a', onPrimary: '#ffffff', onAccent: '#1d1d1f', logoUrl: null,
}

export const EMAIL_FONT = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"

// The accent as TEXT (labels, links) on the white/grey email body: an agent
// who picked a near-white accent would otherwise get invisible links.
export function emailLinkColor(accent: string): string {
  return readableOnLight(accent)
}

// Small uppercase section label in the accent color. `labelHtml` is
// interpolated as-is: escape anything agent- or visitor-entered first.
export function emailEyebrow(labelHtml: string, accent: string, o: { center?: boolean } = {}): string {
  return `<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${emailLinkColor(accent)};text-transform:uppercase;margin-bottom:6px;${o.center ? 'text-align:center;' : ''}">${labelHtml}</div>`
}

// Tinted grey section card. `innerHtml` as-is.
export function emailSection(innerHtml: string): string {
  return `<div style="background:#f6f7f9;border-radius:12px;padding:16px 18px;margin:18px 0;">${innerHtml}</div>`
}

// Filled accent button. `labelHtml` and `href` as-is: escape the href first.
export function emailButton(labelHtml: string, href: string, brand: Pick<EmailBrand, 'accent' | 'onAccent'>, o: { large?: boolean } = {}): string {
  const size = o.large ? 'font-size:15px;padding:11px 22px;border-radius:10px;' : 'font-size:14px;padding:9px 16px;border-radius:8px;margin-top:12px;'
  return `<a href="${href}" style="display:inline-block;background:${brand.accent};color:${brand.onAccent};text-decoration:none;font-weight:700;${size}">${labelHtml}</a>`
}

// Footer sign-off for ohACCESS's own emails (nothing is "powered by" us there).
export const EMAIL_OHACCESS_SIGNOFF = '<span style="font-weight:300;">oh</span><b style="font-weight:700;">ACCESS</b>.com &middot; Patent Pending'

export const EMAIL_POWERED_BY = 'Powered by <span style="font-weight:300;">oh</span><b style="font-weight:700;">ACCESS</b>.com &middot; Patent Pending'

// The full document. All `*Html` fields are interpolated as-is.
export function brandedEmailShell(o: {
  brand: Pick<EmailBrand, 'primary' | 'onPrimary'>
  headerTitleHtml?: string  // bold line under the wordmark
  headerSubHtml?: string    // quieter line under that
  bodyHtml: string
  footerHtml: string        // the "why you got this" lines; the sign-off is appended
  preheaderHtml?: string    // hidden inbox-preview text
  signoffHtml?: string      // defaults to "Powered by ohACCESS"
}): string {
  const { primary, onPrimary } = o.brand
  const title = o.headerTitleHtml
    ? `<div style="font-size:18px;font-weight:700;color:${onPrimary};margin-top:8px;">${o.headerTitleHtml}</div>`
    : ''
  const sub = o.headerSubHtml
    ? `<div style="font-size:13px;color:${onPrimary};opacity:0.75;margin-top:3px;">${o.headerSubHtml}</div>`
    : ''
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#eceef1;font-family:${EMAIL_FONT};">
  ${o.preheaderHtml ? `<div style="display:none;max-height:0;overflow:hidden;">${o.preheaderHtml}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceef1;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td style="background:${primary};text-align:center;padding:28px 20px;">
          <div style="font-size:30px;font-weight:200;letter-spacing:-1px;color:${onPrimary};">oh<b style="font-weight:800;">ACCESS</b></div>
          ${title}${sub}
        </td></tr>
        <tr><td style="padding:28px 26px;color:#1d1d1f;">
          ${o.bodyHtml}
          <div style="border-top:1px solid #ececf0;margin-top:24px;padding-top:14px;font-size:11px;color:#9a9aa0;line-height:1.5;text-align:center;">
            ${o.footerHtml}${o.footerHtml ? '<br>' : ''}
            ${o.signoffHtml ?? EMAIL_POWERED_BY}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

// A short ohACCESS-voiced email (billing notices, invitations, gifts): the
// shared layout in ohACCESS colors around a simple body. `bodyHtml` as-is.
export function ohaccessEmail(o: { bodyHtml: string; footerHtml?: string; headerSubHtml?: string; center?: boolean }): string {
  return brandedEmailShell({
    brand: OHACCESS_BRAND,
    headerSubHtml: o.headerSubHtml,
    signoffHtml: EMAIL_OHACCESS_SIGNOFF,
    bodyHtml: `<div style="font-size:14px;line-height:1.6;color:#1d1d1f;${o.center ? 'text-align:center;' : ''}">${o.bodyHtml}</div>`,
    footerHtml: o.footerHtml ?? '',
  })
}

// Filled gold button for ohACCESS-voiced emails. `labelHtml`/`href` as-is.
export function ohaccessButton(labelHtml: string, href: string): string {
  return emailButton(labelHtml, href, OHACCESS_BRAND, { large: true })
}
