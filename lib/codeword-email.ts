import { escapeHtml } from './escape-html'
import { normalizePhone } from './phone'
import { agentInitials } from './thank-you-email'
import { accentOnPrimary } from './colors'
import { areaAbbrev, areaUnitFor } from './regions'
import { safeUrl, isHexColor, buildDisclosuresHtml, type DisclosureLink } from './register-helpers'

// The visitor's branded codeword email, as a pure builder. Sent at sign-in by
// lib/codeword-messages; also rendered (never sent) by the dashboard's
// "✉️ Visitor emails" preview, so the two can't drift apart.

export type CodewordSponsor = {
  id: string
  full_name: string | null
  company: string | null
  display_email: string | null
  phone: string | null
  license_number: string | null
  headshot_url: string | null
  logo_url: string | null
  landing_page_url: string | null
}

export type CodewordBrokerage = {
  primary_color: string | null
  logo_url: string | null
  disclosure_links: unknown
}

export type CodewordEmailOpts = {
  openHouse: {
    code_word: string | null
    code_word_email: string | null
    property_address: string | null
    open_house_date: string | null
    open_house_hours: string | null
    bedrooms: string | null
    bathrooms: string | null
    square_footage: string | null
    listing_price: string | null
    country?: string | null
  }
  agent: {
    full_name?: string | null
    brokerage?: string | null
    display_email?: string | null
    phone?: string | null
    license_number?: string | null
    state?: string | null
    headshot_url?: string | null
    primary_color?: string | null
    accent_color?: string | null
    logo_url?: string | null
  } | null
  brokerageRow: CodewordBrokerage | null
  sponsor: CodewordSponsor | null
  disclosureLinks: DisclosureLink[]
  listingShortUrl: string | null
  agentShortUrl: string | null
  sponsorShortUrl: string | null
  upcomingHtml: string   // pre-rendered by buildUpcomingOpenHousesHtml ('' if none)
}

// Escapes every agent-controlled field before interpolating it into the HTML
// to prevent injection / tracking-pixel abuse.
export function buildCodewordEmail(o: CodewordEmailOpts): { subject: string; html: string } {
  const { openHouse, agent, brokerageRow, sponsor, listingShortUrl, agentShortUrl, sponsorShortUrl } = o

  // Two code words: the SMS (text) word is primary; the email word is a
  // fallback. Legacy open houses only have code_word, so reuse it for email.
  const emailCodeWord = openHouse.code_word_email || openHouse.code_word
  const fullAddress = openHouse.property_address

  const sponsorConsentName = sponsor
    ? (sponsor.company ? `${sponsor.full_name} (${sponsor.company})` : sponsor.full_name)
    : null

  const agentName = escapeHtml(agent?.full_name || 'Your Agent')
  const agentBrokerage = escapeHtml(agent?.brokerage || '')
  const agentDisplayEmail = escapeHtml(agent?.display_email || '')
  const agentPhone = escapeHtml(agent?.phone || '')
  // Dialable form for the tel: link; null if the number can't be normalized.
  const agentPhoneTel = normalizePhone(agent?.phone)
  // Licence line, gated on the number: the state only ever rides along with
  // a licence number, never on its own.
  const agentLicenseNumber = (agent?.license_number || '').trim()
  const agentLicenseState = (agent?.state || '').trim()
  const agentLicense = agentLicenseNumber
    ? escapeHtml(agentLicenseState ? `${agentLicenseNumber} · ${agentLicenseState}` : agentLicenseNumber)
    : ''
  const headshotUrl = safeUrl(agent?.headshot_url)

  // Team/brokerage members inherit their team's branding (logo + header
  // color) instead of their individual settings, so every agent's emails
  // look consistent. Falls back to the agent's own branding when they
  // aren't on a team or the team hasn't set those fields.
  let brandColor = agent?.primary_color
  let brandLogo = agent?.logo_url
  if (brokerageRow?.primary_color) brandColor = brokerageRow.primary_color
  if (brokerageRow?.logo_url) brandLogo = brokerageRow.logo_url
  const headerColor = isHexColor(brandColor) ? brandColor! : '#1d1d1f'
  const accentColor = isHexColor(agent?.accent_color) ? agent!.accent_color! : '#0071e3'
  const logoUrl = safeUrl(brandLogo)

  // Agent avatar: real headshot when set, otherwise a primary-color circle
  // with the agent's initials in the accent color (skipped without a name).
  const agentInitialsText = escapeHtml(agentInitials(agent?.full_name))
  const agentAvatar = headshotUrl
    ? `<img src="${escapeHtml(headshotUrl)}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid #d1d1d6;margin-right:20px;" />`
    : agentInitialsText
      ? `<div style="width:90px;height:90px;border-radius:50%;background:${headerColor};color:${accentOnPrimary(headerColor, accentColor)};flex-shrink:0;border:2px solid #d1d1d6;margin-right:20px;text-align:center;line-height:90px;font-weight:800;font-size:30px;">${agentInitialsText}</div>`
      : ''

  // "Sponsored by" card — rendered directly below the agent's card + logo.
  // Same escaping rules as the agent block: every sponsor-controlled field
  // goes through escapeHtml/safeUrl before touching the HTML.
  let sponsorHtml = ''
  if (sponsor) {
    const sponsorName = escapeHtml(sponsor.full_name || '')
    const sponsorCompany = escapeHtml(sponsor.company || '')
    const sponsorEmail = escapeHtml(sponsor.display_email || '')
    const sponsorPhone = escapeHtml(sponsor.phone || '')
    const sponsorPhoneTel = normalizePhone(sponsor.phone)
    const sponsorLicense = escapeHtml(sponsor.license_number || '')
    const sponsorHeadshot = safeUrl(sponsor.headshot_url)
    const sponsorLogo = safeUrl(sponsor.logo_url)
    sponsorHtml = `
            <div style="background: #fdfaf3; border: 1px solid #ead9ad; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
              <div style="font-size: 10px; font-weight: 700; color: #8a6a1f; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Sponsored by</div>
              <div style="display: flex; align-items: center;">
                ${sponsorHeadshot ? `<img src="${escapeHtml(sponsorHeadshot)}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid #ead9ad;margin-right:16px;" />` : ''}
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: #1d1d1f;">${sponsorName}</div>
                  ${sponsorCompany ? `<div style="font-size: 12px; color: #6e6e73;">${sponsorCompany}</div>` : ''}
                  ${sponsorEmail ? `<div style="font-size: 12px; color: #0071e3;">${sponsorEmail}</div>` : ''}
                  ${sponsorPhone ? `<div style="font-size: 12px;">${sponsorPhoneTel ? `<a href="tel:${escapeHtml(sponsorPhoneTel)}" style="color: #0071e3; text-decoration: none;">${sponsorPhone}</a>` : `<span style="color: #6e6e73;">${sponsorPhone}</span>`}</div>` : ''}
                  ${sponsorLicense ? `<div style="font-size: 11px; color: #6e6e73;">${sponsorLicense}</div>` : ''}
                  ${sponsorShortUrl ? `<div><a href="${escapeHtml(sponsorShortUrl)}" style="font-size: 12px; color: #0071e3;">Sponsor information</a></div>` : ''}
                </div>
              </div>
              ${sponsorLogo ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ead9ad; text-align: center;"><img src="${escapeHtml(sponsorLogo)}" style="max-height:60px;width:70%;object-fit:contain;" /></div>` : ''}
              <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ead9ad; font-size: 10px; color: #8a6a1f; line-height: 1.5; text-align: center;">
                You are not required to use ${sponsorCompany || sponsorName} for any service. You are free to shop around.
              </div>
            </div>`
  }

  const subject = `Your ohACCESS codeword: ${emailCodeWord}`

  const html = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 8px;">
          <div style="background: ${headerColor}; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
            <div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">Your codeword is ready</div>
          </div>
          <div style="background: white; border-radius: 0 0 16px 16px; padding: 14px;">
            <div style="background: #f5f5f7; border: 1px dashed #d1d1d6; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 16px;">
              <div style="font-size: 11px; color: #6e6e73; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">Your Email Codeword</div>
              <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #1d1d1f;"><q>${escapeHtml(emailCodeWord)}</q></div>
              <div style="font-size: 12px; color: #6e6e73; margin-top: 8px;">Share this codeword with the host at the door to gain access.</div>
              <div style="font-size: 11px; color: #6e6e73; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e5ea;">📱 We also texted you a separate codeword. If the host asks for your <strong>SMS codeword</strong>, check your phone&apos;s messages.</div>
            </div>
            <div style="background: #f5f5f7; border-radius: 10px; padding: 14px; margin-bottom: 16px; font-size: 13px; color: #6e6e73; line-height: 1.8;">
              <strong style="color: #1d1d1f;">${escapeHtml(fullAddress)}</strong><br/>
              📅 ${escapeHtml(openHouse.open_house_date)}<br/>
              🕒 ${escapeHtml(openHouse.open_house_hours)}<br/>
              🛏 ${escapeHtml(openHouse.bedrooms || '—')} bed · 🛁 ${escapeHtml(openHouse.bathrooms || '—')} bath · 📐 ${escapeHtml(openHouse.square_footage || '—')} ${areaAbbrev(areaUnitFor(openHouse.country))} <br/>
              💰 ${escapeHtml(openHouse.listing_price || '—')}<br/>
              ${listingShortUrl ? `📝 <a href="${escapeHtml(listingShortUrl)}" style="color: #0071e3; font-weight: 600; font-size: 13px;">Full listing details </a>` : ''}
            </div>
            <div style="background: #f5f5f7; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
              <div style="font-size: 15px; font-weight: 800; color: #1d1d1f;">Want a private tour?</div>
              <div style="font-size: 12px; color: #6e6e73; line-height: 1.6; margin: 3px 0 12px;">I'm happy to show you this home, or any other, on your schedule. Call me or just reply to this email.</div>
              <div style="display: flex; align-items: center;">
                ${agentAvatar}
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: #1d1d1f;">${agentName}</div>
                  <div style="font-size: 12px; color: #6e6e73;">${agentBrokerage}</div>
                  ${agentDisplayEmail ? `<div style="font-size: 12px; color: #0071e3;">${agentDisplayEmail}</div>` : ''}
                  ${agentPhone ? `<div style="font-size: 12px;">${agentPhoneTel ? `<a href="tel:${escapeHtml(agentPhoneTel)}" style="color: #0071e3; text-decoration: none;">${agentPhone}</a>` : `<span style="color: #6e6e73;">${agentPhone}</span>`}</div>` : ''}
                  ${agentLicense ? `<div style="font-size: 11px; color: #6e6e73;">${agentLicense}</div>` : ''}
                  ${agentShortUrl ? `<div><a href="${escapeHtml(agentShortUrl)}" style="font-size: 12px; color: #0071e3;">Agent information</a></div>` : ''}
                </div>
              </div>
              ${logoUrl
                ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e5ea; text-align: center;"><img src="${escapeHtml(logoUrl)}" style="max-height:80px;width:80%;object-fit:contain;" /></div>`
                : agentBrokerage
                  ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e5ea; text-align: center; font-size: 20px; font-weight: 800; letter-spacing: -0.3px; color: ${headerColor};">${agentBrokerage}</div>`
                  : ''}
            </div>
            ${sponsorHtml}
            ${buildDisclosuresHtml(o.disclosureLinks)}
            ${o.upcomingHtml}
            <div style="margin-top: 16px; padding: 12px; background: #f5f5f7; border-radius: 8px; font-size: 11px; color: #6e6e73; text-align: center; line-height: 1.6;">
              By registering you agreed to the ohACCESS <a href="https://ohaccess.com/terms" style="color: #6e6e73;">Terms of Service</a>.<br/>
              You consent to be contacted by the host agent${sponsorConsentName ? ` and today's sponsor, ${escapeHtml(sponsorConsentName)}` : ''}.<br/>
              Reply STOP to any text to opt out · <a href="https://ohaccess.com/privacy" style="color: #6e6e73;">Privacy Policy</a><br/>
              <em style="color: #6e6e73;">Heads up: opting out blocks codewords for all future ohACCESS open houses.</em>
            </div>
          </div>
        </div>
      `

  return { subject, html }
}
