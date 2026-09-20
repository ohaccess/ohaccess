import { escapeHtml } from './escape-html'
import { buildAgentCardHtml, buildSponsorCardHtml } from './email-cards'
import { areaAbbrev, areaUnitFor } from './regions'
import { buildDisclosuresHtml, type DisclosureLink } from './register-helpers'
import { brandedEmailShell, emailButton, emailSection, resolveEmailBranding } from './email-shell'

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
  accent_color?: string | null
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

  // Team/brokerage members inherit their team's branding, by the same rule
  // as every other branded email (lib/email-shell).
  const brand = resolveEmailBranding(agent, brokerageRow && {
    primary_color: brokerageRow.primary_color,
    accent_color: brokerageRow.accent_color,
    logo_url: brokerageRow.logo_url,
  })

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
    logoUrl: brand.logoUrl,
    infoUrl: agentShortUrl,
  }, {
    primary: brand.primary,
    accent: brand.accent,
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
      }, { accent: brand.accent })
    : ''

  const subject = `Your ohACCESS codeword: ${emailCodeWord}`

  const html = brandedEmailShell({
    brand,
    headerSubHtml: 'Your codeword is ready',
    bodyHtml: `
            <div style="background: #f6f7f9; border: 1px dashed #d1d1d6; border-radius: 12px; padding: 16px; text-align: center;">
              <div style="font-size: 11px; color: #6e6e73; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">Your Email Codeword</div>
              <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #1d1d1f;"><q>${escapeHtml(emailCodeWord)}</q></div>
              <div style="font-size: 12px; color: #6e6e73; margin-top: 8px;">Share this codeword with the host at the door to gain access.</div>
              <div style="font-size: 11px; color: #6e6e73; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e5ea;">📱 We also texted you a separate codeword. If the host asks for your <strong>SMS codeword</strong>, check your phone&apos;s messages.</div>
            </div>
            ${emailSection(`<div style="font-size: 13px; color: #6e6e73; line-height: 1.8;">
              <strong style="color: #1d1d1f;">${escapeHtml(fullAddress)}</strong><br/>
              📅 ${escapeHtml(openHouse.open_house_date)}<br/>
              🕒 ${escapeHtml(openHouse.open_house_hours)}<br/>
              🛏 ${escapeHtml(openHouse.bedrooms || '—')} bed · 🛁 ${escapeHtml(openHouse.bathrooms || '—')} bath · 📐 ${escapeHtml(openHouse.square_footage || '—')} ${areaAbbrev(areaUnitFor(openHouse.country))} <br/>
              💰 ${escapeHtml(openHouse.listing_price || '—')}</div>
              ${listingShortUrl ? emailButton('View the listing &rarr;', escapeHtml(listingShortUrl), brand) : ''}`)}
            ${agentCardHtml}
            ${sponsorHtml}
            ${buildDisclosuresHtml(o.disclosureLinks, brand.accent)}
            ${o.upcomingHtml}`,
    footerHtml: `By registering you agreed to the ohACCESS <a href="https://ohaccess.com/terms" style="color: #9a9aa0;">Terms of Service</a>.<br/>
              You consent to be contacted by the host agent${sponsorConsentName ? ` and today's sponsor, ${escapeHtml(sponsorConsentName)}` : ''}.<br/>
              Reply STOP to any text to opt out · <a href="https://ohaccess.com/privacy" style="color: #9a9aa0;">Privacy Policy</a><br/>
              <em>Heads up: opting out blocks codewords for all future ohACCESS open houses.</em>`,
  })

  return { subject, html }
}
