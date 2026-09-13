import { escapeHtml } from './escape-html'
import { buildAgentCardHtml, buildSponsorCardHtml } from './email-cards'
import { areaAbbrev, areaUnitFor } from './regions'
import { isHexColor, buildDisclosuresHtml, type DisclosureLink } from './register-helpers'

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

  // Agent card + logo, then the "Sponsored by" card + logo: the shared
  // builders every visitor email uses (lib/email-cards), so they match.
  const agentCardHtml = buildAgentCardHtml({
    name: agent?.full_name || 'Your Agent',
    brokerage: agent?.brokerage || null,
    email: agent?.display_email || null,
    phone: agent?.phone || null,
    licenseNumber: agent?.license_number || null,
    licenseState: agent?.state || null,
    headshotUrl: agent?.headshot_url || null,
    logoUrl: brandLogo || null,
    infoUrl: agentShortUrl,
  }, {
    primary: headerColor,
    accent: accentColor,
    heading: 'Want a private tour?',
    blurb: "I'm happy to show you this home, or any other, on your schedule. Call me or just reply to this email.",
  })
  const sponsorHtml = sponsor
    ? buildSponsorCardHtml({
        name: sponsor.full_name || '',
        company: sponsor.company,
        email: sponsor.display_email,
        phone: sponsor.phone,
        licenseNumber: sponsor.license_number,
        headshotUrl: sponsor.headshot_url,
        logoUrl: sponsor.logo_url,
        infoUrl: sponsorShortUrl,
      })
    : ''

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
            ${agentCardHtml}
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
