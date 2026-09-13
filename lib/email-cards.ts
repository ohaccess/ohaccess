import { escapeHtml } from './escape-html'
import { normalizePhone } from './phone'
import { safeUrl } from './register-helpers'
import { accentOnPrimary } from './colors'

// The agent card and "Sponsored by" card shared by every visitor email
// (codeword at sign-in, next-morning thank-you, open-house invite), so each
// person looks the same everywhere. Table layout, since Gmail and Outlook drop
// flexbox. Logos sit BELOW each card, outside its tinted background, so a logo
// on a white square doesn't look pasted on.

export type AgentCard = {
  name: string
  brokerage: string | null
  email: string | null
  phone: string | null
  licenseNumber: string | null
  licenseState: string | null
  headshotUrl: string | null
  logoUrl: string | null      // brokerage-over-agent logo, already resolved
  infoUrl: string | null      // "Agent information" (tracked short link when sent)
}

export type SponsorCard = {
  name: string
  company: string | null
  email: string | null
  phone: string | null
  licenseNumber: string | null
  headshotUrl: string | null
  logoUrl: string | null
  infoUrl: string | null      // "Sponsor information" (tracked short link when sent)
}

const AVATAR_PX = 64

// Initials for the fallback avatar when the agent has no headshot photo.
export function agentInitials(name: string | null | undefined): string {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const first = words[0][0] || ''
  const last = words.length > 1 ? words[words.length - 1][0] || '' : ''
  return (first + last).toUpperCase()
}

export function buildAgentCardHtml(
  a: AgentCard,
  o: { primary: string; accent: string; heading?: string; blurb?: string }
): string {
  const e = escapeHtml
  const headshot = safeUrl(a.headshotUrl)
  const initials = agentInitials(a.name)
  const avatar = headshot
    ? avatarImg(headshot, '#d1d1d6')
    : initials
      ? `<div style="width:${AVATAR_PX}px;height:${AVATAR_PX}px;border-radius:50%;background:${o.primary};color:${accentOnPrimary(o.primary, o.accent)};text-align:center;line-height:${AVATAR_PX}px;font-weight:800;font-size:22px;border:2px solid #d1d1d6;">${e(initials)}</div>`
      : ''

  // Licence line, gated on the number: the state only rides along with one.
  const licenseNumber = (a.licenseNumber || '').trim()
  const licenseState = (a.licenseState || '').trim()
  const license = licenseNumber ? (licenseState ? `${licenseNumber} · ${licenseState}` : licenseNumber) : ''

  const top = o.heading
    ? `<div style="font-size:17px;font-weight:800;color:#1d1d1f;">${e(o.heading)}</div>${o.blurb ? `<div style="font-size:14px;color:#444;line-height:1.6;margin-top:4px;">${e(o.blurb)}</div>` : ''}`
    : ''

  // Below the card: the logo when set, otherwise the brokerage name.
  const logo = safeUrl(a.logoUrl)
  const brand = logo
    ? logoHtml(logo, a.brokerage || '')
    : a.brokerage
      ? `<div style="text-align:center;margin:12px 0 0;font-size:19px;font-weight:800;letter-spacing:-0.3px;color:${o.primary};">${e(a.brokerage)}</div>`
      : ''

  const card = cardHtml({
    background: '#f6f7f9', border: '#f6f7f9', top, avatar,
    details: detailsHtml({ name: a.name, org: a.brokerage, email: a.email, phone: a.phone, license, infoUrl: a.infoUrl, infoLabel: 'Agent information', linkColor: o.accent }),
    bottom: '',
  })
  return `<div style="margin:18px 0;">${card}${brand}</div>`
}

export function buildSponsorCardHtml(s: SponsorCard): string {
  const e = escapeHtml
  const headshot = safeUrl(s.headshotUrl)
  const logo = safeUrl(s.logoUrl)
  const card = cardHtml({
    background: '#fdfaf3', border: '#ead9ad',
    top: '<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#8a6a1f;text-transform:uppercase;">Sponsored by</div>',
    avatar: headshot ? avatarImg(headshot, '#ead9ad') : '',
    details: detailsHtml({ name: s.name, org: s.company, email: s.email, phone: s.phone, license: (s.licenseNumber || '').trim(), infoUrl: s.infoUrl, infoLabel: 'Sponsor information', linkColor: '#0071e3' }),
    bottom: `<div style="border-top:1px solid #ead9ad;padding-top:10px;font-size:11px;color:#8a6a1f;line-height:1.5;text-align:center;">You are not required to use ${e(s.company || s.name)} for any service. You are free to shop around.</div>`,
  })
  return `<div style="margin:18px 0;">${card}${logo ? logoHtml(logo, s.company || s.name) : ''}</div>`
}

function avatarImg(url: string, borderColor: string): string {
  return `<img src="${escapeHtml(url)}" width="${AVATAR_PX}" height="${AVATAR_PX}" alt="" style="width:${AVATAR_PX}px;height:${AVATAR_PX}px;border-radius:50%;object-fit:cover;display:block;border:2px solid ${borderColor};">`
}

function logoHtml(url: string, alt: string): string {
  return `<div style="text-align:center;margin:12px 0 0;"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" style="max-height:56px;max-width:70%;object-fit:contain;"></div>`
}

// Tinted card: optional row above (heading / "Sponsored by"), the avatar +
// details row, optional row below (disclaimer).
function cardHtml(c: { background: string; border: string; top: string; avatar: string; details: string; bottom: string }): string {
  const cols = c.avatar ? 2 : 1
  const padTop = c.top ? 12 : 16
  const padBottom = c.bottom ? 12 : 16
  const topRow = c.top ? `<tr><td colspan="${cols}" style="padding:16px 16px 0;">${c.top}</td></tr>` : ''
  const avatarTd = c.avatar
    ? `<td width="${AVATAR_PX + 4}" style="width:${AVATAR_PX + 4}px;padding:${padTop}px 0 ${padBottom}px 16px;vertical-align:middle;">${c.avatar}</td>`
    : ''
  const detailsTd = `<td style="padding:${padTop}px 16px ${padBottom}px ${c.avatar ? 14 : 16}px;vertical-align:middle;">${c.details}</td>`
  const bottomRow = c.bottom ? `<tr><td colspan="${cols}" style="padding:0 16px 14px;">${c.bottom}</td></tr>` : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.background};border:1px solid ${c.border};border-radius:12px;border-collapse:separate;">${topRow}<tr>${avatarTd}${detailsTd}</tr>${bottomRow}</table>`
}

// Name, company, email, phone, licence, info link: one line each, so every
// link is a full, separate tap target on a phone.
function detailsHtml(p: {
  name: string; org: string | null; email: string | null; phone: string | null
  license: string; infoUrl: string | null; infoLabel: string; linkColor: string
}): string {
  const e = escapeHtml
  const org = (p.org || '').trim()
  const email = (p.email || '').trim()
  const phone = (p.phone || '').trim()
  const tel = normalizePhone(phone)
  const infoUrl = safeUrl(p.infoUrl)
  return [
    `<div style="font-size:15px;font-weight:700;color:#1d1d1f;">${e(p.name)}</div>`,
    org ? `<div style="font-size:13px;color:#6e6e73;">${e(org)}</div>` : '',
    email ? `<div style="font-size:13px;margin-top:3px;word-break:break-word;"><a href="mailto:${e(email)}" style="color:${p.linkColor};text-decoration:none;">${e(email)}</a></div>` : '',
    phone ? `<div style="font-size:13px;">${tel ? `<a href="tel:${e(tel)}" style="color:${p.linkColor};text-decoration:none;font-weight:600;">${e(phone)}</a>` : `<span style="color:#6e6e73;">${e(phone)}</span>`}</div>` : '',
    p.license ? `<div style="font-size:12px;color:#6e6e73;">${e(p.license)}</div>` : '',
    infoUrl ? `<div style="font-size:13px;margin-top:3px;"><a href="${e(infoUrl)}" style="color:${p.linkColor};font-weight:600;">${e(p.infoLabel)}</a></div>` : '',
  ].join('')
}
