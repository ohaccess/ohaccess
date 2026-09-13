import { describe, it, expect } from 'vitest'
import { buildAgentCardHtml, buildSponsorCardHtml, type AgentCard, type SponsorCard } from '../lib/email-cards'

const agent: AgentCard = {
  name: 'Kathryn Chen', brokerage: 'Reflect Real Estate', email: 'kathryn+tours@reflectre.com', phone: '(817) 555-0142',
  licenseNumber: '0654321', licenseState: 'TX', headshotUrl: 'https://example.com/k.jpg',
  logoUrl: 'https://example.com/logo.png', infoUrl: 'https://ohaccess.com/r/abc',
}
const sponsor: SponsorCard = {
  name: 'Dave Brown', company: 'Brown Mortgage Group', email: 'dave@example.com', phone: '(469) 557-5048',
  licenseNumber: 'NMLS 12345', headshotUrl: 'https://example.com/d.jpg',
  logoUrl: 'https://example.com/bmg.png', infoUrl: 'https://ohaccess.com/r/xyz',
}
const branding = { primary: '#112233', accent: '#ff6600' }

describe('buildAgentCardHtml', () => {
  it('shows the headshot, full contact details, licence and info link', () => {
    const html = buildAgentCardHtml(agent, branding)
    expect(html).toContain('https://example.com/k.jpg')
    expect(html).toContain('href="mailto:kathryn+tours@reflectre.com"')
    expect(html).toContain('href="tel:')
    expect(html).toContain('0654321 · TX')
    expect(html).toContain('href="https://ohaccess.com/r/abc"')
    expect(html).toContain('Agent information')
  })
  it('puts the logo below the tinted card, not inside it', () => {
    const html = buildAgentCardHtml(agent, branding)
    expect(html.indexOf('https://example.com/logo.png')).toBeGreaterThan(html.lastIndexOf('</table>'))
  })
  it('falls back to initials and the brokerage name', () => {
    const html = buildAgentCardHtml({ ...agent, headshotUrl: null, logoUrl: null, infoUrl: null }, branding)
    expect(html).toContain('>KC</div>')
    expect(html).toContain('Reflect Real Estate</div></div>')
    expect(html).not.toContain('Agent information')
  })
  it('only shows the state alongside a licence number', () => {
    expect(buildAgentCardHtml({ ...agent, licenseNumber: null }, branding)).not.toContain('TX')
  })
  it('escapes agent-controlled text', () => {
    const html = buildAgentCardHtml({ ...agent, name: '<script>x</script>', heading: undefined } as AgentCard, { ...branding, heading: '<b>hi</b>' })
    expect(html).not.toContain('<script>x</script>')
    expect(html).not.toContain('<b>hi</b>')
  })
})

describe('buildSponsorCardHtml', () => {
  it('shows the headshot, contact details, info link and disclaimer', () => {
    const html = buildSponsorCardHtml(sponsor)
    expect(html).toContain('Sponsored by')
    expect(html).toContain('https://example.com/d.jpg')
    expect(html).toContain('href="mailto:dave@example.com"')
    expect(html).toContain('NMLS 12345')
    expect(html).toContain('href="https://ohaccess.com/r/xyz"')
    expect(html).toContain('Sponsor information')
    expect(html).toContain('not required to use Brown Mortgage Group')
  })
  it('puts the logo below the tinted card, not inside it', () => {
    const html = buildSponsorCardHtml(sponsor)
    expect(html.indexOf('https://example.com/bmg.png')).toBeGreaterThan(html.lastIndexOf('</table>'))
  })
  it('drops what the sponsor has not set', () => {
    const html = buildSponsorCardHtml({ ...sponsor, headshotUrl: null, logoUrl: null, infoUrl: null, email: null })
    expect(html).not.toContain('<img')
    expect(html).not.toContain('Sponsor information')
    expect(html).not.toContain('mailto:')
  })
})
