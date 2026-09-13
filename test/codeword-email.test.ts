import { describe, it, expect } from 'vitest'
import { buildCodewordEmail, type CodewordEmailOpts } from '../lib/codeword-email'

const base: CodewordEmailOpts = {
  openHouse: {
    code_word: 'maple', code_word_email: 'lantern',
    property_address: '4124 Cory Lee Court, Arlington, TX 76017',
    open_house_date: 'Saturday, September 19, 2026', open_house_hours: '1:00 PM – 4:00 PM',
    bedrooms: '4', bathrooms: '3', square_footage: '2,450', listing_price: '$625,000', country: 'US',
  },
  agent: { full_name: 'Kathryn Chen', brokerage: 'REFLECT Real Estate', display_email: 'k@example.com', phone: '(512) 555-1234', primary_color: '#112233', accent_color: '#ff6600' },
  brokerageRow: null,
  sponsor: null,
  disclosureLinks: [],
  listingShortUrl: null,
  agentShortUrl: null,
  sponsorShortUrl: null,
  upcomingHtml: '',
}

describe('buildCodewordEmail', () => {
  it('uses the email codeword in the subject and body', () => {
    const { subject, html } = buildCodewordEmail(base)
    expect(subject).toBe('Your ohACCESS codeword: lantern')
    expect(html).toContain('<q>lantern</q>')
    expect(html).toContain('background: #112233')
  })
  it('falls back to the text codeword on legacy open houses', () => {
    const { subject } = buildCodewordEmail({ ...base, openHouse: { ...base.openHouse, code_word_email: null } })
    expect(subject).toBe('Your ohACCESS codeword: maple')
  })
  it('lets team branding override the agent header color and logo', () => {
    const { html } = buildCodewordEmail({ ...base, brokerageRow: { primary_color: '#445566', logo_url: 'https://example.com/logo.png', disclosure_links: null } })
    expect(html).toContain('background: #445566')
    expect(html).toContain('https://example.com/logo.png')
  })
  it('escapes agent-controlled text', () => {
    const { html } = buildCodewordEmail({ ...base, agent: { ...base.agent, full_name: '<script>x</script>' } })
    expect(html).not.toContain('<script>x</script>')
  })
  it('names the sponsor in the consent line only when there is one', () => {
    expect(buildCodewordEmail(base).html).not.toContain("today's sponsor")
    const { html } = buildCodewordEmail({ ...base, sponsor: { id: 's1', full_name: 'Pat Lender', company: 'Acme Mortgage', display_email: null, phone: null, license_number: null, headshot_url: null, logo_url: null, landing_page_url: null } })
    expect(html).toContain("today's sponsor, Pat Lender (Acme Mortgage)")
  })
})
