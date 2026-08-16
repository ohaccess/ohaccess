import { describe, it, expect } from 'vitest'
import {
  generateCode,
  buildSmsBody,
  isHttpUrl,
  safeUrl,
  isHexColor,
  isEmail,
  buildCrmLeadEmail,
  buildUpcomingOpenHousesHtml,
  agentCopyRecipients,
  isVirtualNumber,
  phoneLineKind,
  twilioStatusCallbackUrl,
  normalizeDisclosureLinks,
  resolveDisclosureLinks,
  buildDisclosuresHtml,
  MAX_DISCLOSURE_LINKS,
  MAX_DISCLOSURE_LABEL_LENGTH,
  SMS_MAX_LENGTH,
  SMS_CODE_WORD_MAX_LENGTH,
  sanitizeSmsCodeWord,
  type UpcomingOpenHouse,
} from '@/lib/register-helpers'

describe('generateCode', () => {
  it('produces an 8-char alphanumeric slug', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCode()).toMatch(/^[a-zA-Z0-9]{8}$/)
    }
  })
})

describe('buildSmsBody', () => {
  it('returns the base unchanged when there are no extras', () => {
    expect(buildSmsBody('Your code is CATDOG', [])).toBe('Your code is CATDOG')
  })
  it('appends an extra link when it fits within the SMS budget', () => {
    const out = buildSmsBody('Your code is CATDOG', [{ label: 'View', url: 'https://a.co/x' }])
    expect(out).toBe('Your code is CATDOG View: https://a.co/x')
    expect(out.length).toBeLessThanOrEqual(SMS_MAX_LENGTH)
  })
  it('appends a bare URL (no label/colon) when the label is empty', () => {
    const out = buildSmsBody('Your code is CATDOG', [{ label: '', url: 'https://a.co/x' }])
    expect(out).toBe('Your code is CATDOG https://a.co/x')
  })
  it('drops an extra that would exceed SMS_MAX_LENGTH', () => {
    const base = 'x'.repeat(150)
    const out = buildSmsBody(base, [{ label: 'View', url: 'https://example.com/listing' }])
    expect(out).toBe(base)
  })
  it('never exceeds the SMS budget even with several extras', () => {
    const base = 'Code CATDOG'
    const out = buildSmsBody(base, [
      { label: 'A', url: 'https://a.co/' + 'a'.repeat(200) },
      { label: 'B', url: 'https://b.co/short' },
    ])
    expect(out.length).toBeLessThanOrEqual(SMS_MAX_LENGTH)
    expect(out).toContain('B: https://b.co/short') // the one that fits still lands
  })
})

describe('sanitizeSmsCodeWord', () => {
  it('uppercases a normal word and leaves it otherwise intact', () => {
    expect(sanitizeSmsCodeWord('lovely')).toBe('LOVELY')
  })
  it('keeps digits', () => {
    expect(sanitizeSmsCodeWord('Oak12')).toBe('OAK12')
  })
  it('strips spaces and punctuation', () => {
    expect(sanitizeSmsCodeWord("Grand-Manor's")).toBe('GRANDMANORS')
  })
  it('strips emoji and accented letters that would force UCS-2 encoding', () => {
    expect(sanitizeSmsCodeWord('CAFÉ🏡')).toBe('CAF')
    expect(sanitizeSmsCodeWord('“CURLY”')).toBe('CURLY')
  })
  it('truncates to the cap', () => {
    const out = sanitizeSmsCodeWord('A'.repeat(50))
    expect(out).toHaveLength(SMS_CODE_WORD_MAX_LENGTH)
  })
  it('truncates AFTER stripping, so filler characters do not eat the budget', () => {
    expect(sanitizeSmsCodeWord('!!!!!!!!!!!!!!!!!!!!LOVELY')).toBe('LOVELY')
  })
  it('returns empty for null/undefined/all-invalid input', () => {
    expect(sanitizeSmsCodeWord(null)).toBe('')
    expect(sanitizeSmsCodeWord(undefined)).toBe('')
    expect(sanitizeSmsCodeWord('🏡🏡')).toBe('')
  })
  it('keeps the visitor SMS to one segment even at the cap with a long address', () => {
    const address = '18732 Rancho Santa Margarita Parkway Suite 400'
    const word = sanitizeSmsCodeWord('W'.repeat(SMS_CODE_WORD_MAX_LENGTH))
    const body = `Codeword at ${address} is "${word}". Share with host for access. Reply STOP to opt out.`
    expect(body.length).toBeLessThanOrEqual(SMS_MAX_LENGTH)
  })
  it('every auto-generated SMS word survives sanitizing unchanged', () => {
    const words = ['BESPOKE','CHARMING','CLASSIC','COZY','ELEGANT','GRAND','HISTORIC','INVITING','LOVELY','LUXE','MODERN','POLISHED','PRISTINE','RADIANT','REFINED','SERENE','SPACIOUS','STATELY','STUNNING','STYLISH','TIMELESS','TRANQUIL','WELCOMING']
    for (const w of words) expect(sanitizeSmsCodeWord(w)).toBe(w)
  })
})

describe('isHttpUrl / safeUrl', () => {
  it('accepts only http(s) URLs', () => {
    expect(isHttpUrl('http://x.co')).toBe(true)
    expect(isHttpUrl('https://x.co')).toBe(true)
    expect(isHttpUrl('HTTPS://X.CO')).toBe(true)
  })
  it('rejects dangerous / non-web schemes and empties', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('data:text/html,<script>')).toBe(false)
    expect(isHttpUrl('ftp://x.co')).toBe(false)
    expect(isHttpUrl('')).toBe(false)
    expect(isHttpUrl(null)).toBe(false)
  })
  it('safeUrl returns the URL when valid and empty string otherwise', () => {
    expect(safeUrl('https://x.co')).toBe('https://x.co')
    expect(safeUrl('javascript:alert(1)')).toBe('')
    expect(safeUrl(null)).toBe('')
  })
})

describe('isHexColor', () => {
  it('accepts 3-to-8 digit hex colors', () => {
    expect(isHexColor('#fff')).toBe(true)
    expect(isHexColor('#ffffff')).toBe(true)
    expect(isHexColor('#12345678')).toBe(true)
  })
  it('rejects malformed or over-long values', () => {
    expect(isHexColor('#12')).toBe(false)
    expect(isHexColor('#123456789')).toBe(false)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor('#gghhii')).toBe(false)
    expect(isHexColor(null)).toBe(false)
  })
})

describe('isEmail', () => {
  it('accepts a plausible email and trims surrounding whitespace', () => {
    expect(isEmail('lead@example.com')).toBe(true)
    expect(isEmail('  lead@example.com  ')).toBe(true)
  })
  it('rejects malformed addresses', () => {
    expect(isEmail('no-at-sign')).toBe(false)
    expect(isEmail('missing@domain')).toBe(false)
    expect(isEmail('two spaces@x.co')).toBe(false)
    expect(isEmail(null)).toBe(false)
  })
})

describe('buildCrmLeadEmail', () => {
  const base = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+14158675309',
    purchasingTimeline: '3-6 months',
    propertyAddress: '1 Main St',
    agentName: 'Agent Smith',
    registeredAt: '2026-07-01',
    visitorUrl: 'https://ohaccess.com/visitor/abc',
  }

  it('includes the labeled lead fields CRMs parse', () => {
    const html = buildCrmLeadEmail(base)
    expect(html).toContain('Name: Jane Doe')
    expect(html).toContain('Email: jane@example.com')
    expect(html).toContain('lead_name')
  })

  it('escapes attacker-controlled fields (no raw HTML injection)', () => {
    const html = buildCrmLeadEmail({ ...base, firstName: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('buildUpcomingOpenHousesHtml', () => {
  const APP_URL = 'https://www.ohaccess.com'
  const oh: UpcomingOpenHouse = {
    id: 'oh-123',
    property_address: '123 Main St, Austin, TX 78701',
    city: 'Austin',
    open_house_date: 'Sat, Jul 18, 2026',
    open_house_hours: '1:00 PM – 3:00 PM',
    listing_price: '$625,000',
    bedrooms: '4',
    bathrooms: '3',
    start_at: '2026-07-18T18:00:00+00:00',
    end_at: '2026-07-18T20:00:00+00:00',
  }

  it('returns an empty string when there are no upcoming open houses', () => {
    expect(buildUpcomingOpenHousesHtml([], APP_URL)).toBe('')
  })

  it('shows day and time plus price and beds/baths — no city, the address line carries it', () => {
    const html = buildUpcomingOpenHousesHtml([oh], APP_URL)
    expect(html).toContain('Upcoming Open Houses')
    expect(html).toContain('Sat, Jul 18, 2026 &middot; 1:00 PM – 3:00 PM</div>')
    expect(html).toContain('$625,000')
    expect(html).toContain('4 bed')
    expect(html).toContain('3 bath')
  })

  it('falls back to city on the when-line only when the address is missing', () => {
    const html = buildUpcomingOpenHousesHtml([{ ...oh, property_address: null }], APP_URL)
    expect(html).toContain('Sat, Jul 18, 2026 &middot; 1:00 PM – 3:00 PM &middot; Austin')
  })

  it('links the address to Google Maps', () => {
    const html = buildUpcomingOpenHousesHtml([oh], APP_URL)
    expect(html).toContain('https://www.google.com/maps/search/?api=1&amp;query=123%20Main%20St')
  })

  it('builds Google, Outlook, and Apple (.ics) calendar links with UTC times', () => {
    const html = buildUpcomingOpenHousesHtml([oh], APP_URL)
    expect(html).toContain('calendar.google.com/calendar/render')
    expect(html).toContain('20260718T180000Z/20260718T200000Z')
    expect(html).toContain('outlook.live.com/calendar/0/action/compose')
    expect(html).toContain(`${APP_URL}/api/open-house/oh-123/calendar`)
  })

  it('omits calendar links when a legacy row has no start time', () => {
    const html = buildUpcomingOpenHousesHtml([{ ...oh, start_at: null, end_at: null }], APP_URL)
    expect(html).not.toContain('Add to calendar')
    expect(html).toContain('123 Main St') // the listing itself still renders
  })

  it('skips missing fields without leaving dangling separators', () => {
    const html = buildUpcomingOpenHousesHtml(
      [{ ...oh, listing_price: null, bedrooms: null, bathrooms: null, city: null }],
      APP_URL
    )
    expect(html).toContain('Sat, Jul 18, 2026 &middot; 1:00 PM – 3:00 PM</div>')
    expect(html).not.toContain('💰')
    expect(html).not.toContain('bed')
  })

  it('escapes agent-entered fields (no raw HTML injection)', () => {
    const html = buildUpcomingOpenHousesHtml(
      [{ ...oh, listing_price: '<script>alert(1)</script>' }],
      APP_URL
    )
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('renders one row per open house', () => {
    const html = buildUpcomingOpenHousesHtml(
      [oh, { ...oh, id: 'oh-456', property_address: '9 Oak Ln, Round Rock, TX 78664' }],
      APP_URL
    )
    expect(html).toContain('oh-123/calendar')
    expect(html).toContain('oh-456/calendar')
    expect(html).toContain('9 Oak Ln, Round Rock, TX 78664')
  })
})

describe('agentCopyRecipients', () => {
  it('CCs the display email and BCCs the login email when both are set and differ', () => {
    expect(agentCopyRecipients('public@agent.com', 'login@agent.com')).toEqual({
      cc: ['public@agent.com'],
      bcc: ['login@agent.com'],
    })
  })
  it('dedupes when display and login are the same address (no double send)', () => {
    expect(agentCopyRecipients('same@agent.com', 'same@agent.com')).toEqual({
      cc: ['same@agent.com'],
      bcc: [],
    })
  })
  it('falls back to the login email for the CC when no display email is set', () => {
    expect(agentCopyRecipients('', 'login@agent.com')).toEqual({
      cc: ['login@agent.com'],
      bcc: [],
    })
    expect(agentCopyRecipients(null, 'login@agent.com')).toEqual({
      cc: ['login@agent.com'],
      bcc: [],
    })
  })
  it('CCs the display email and adds no BCC when there is no login email', () => {
    expect(agentCopyRecipients('public@agent.com', null)).toEqual({
      cc: ['public@agent.com'],
      bcc: [],
    })
  })
  it('never exposes the login email as a visible CC when a display email exists', () => {
    const { cc } = agentCopyRecipients('public@agent.com', 'login@agent.com')
    expect(cc).not.toContain('login@agent.com')
  })
  it('drops invalid addresses and trims whitespace', () => {
    expect(agentCopyRecipients('not-an-email', 'login@agent.com')).toEqual({
      cc: ['login@agent.com'],
      bcc: [],
    })
    expect(agentCopyRecipients('  public@agent.com  ', '  login@agent.com  ')).toEqual({
      cc: ['public@agent.com'],
      bcc: ['login@agent.com'],
    })
    expect(agentCopyRecipients(null, null)).toEqual({ cc: [], bcc: [] })
  })
})

describe('isVirtualNumber', () => {
  it('flags only nonFixedVoip (burner-app numbers)', () => {
    expect(isVirtualNumber('nonFixedVoip')).toBe(true)
  })
  it('does not flag real mobile, landline, or cable-company VoIP lines', () => {
    expect(isVirtualNumber('mobile')).toBe(false)
    expect(isVirtualNumber('landline')).toBe(false)
    expect(isVirtualNumber('fixedVoip')).toBe(false)
  })
  it('treats missing lookup data as not flagged', () => {
    expect(isVirtualNumber(null)).toBe(false)
    expect(isVirtualNumber(undefined)).toBe(false)
    expect(isVirtualNumber('')).toBe(false)
  })
})

describe('phoneLineKind', () => {
  it('labels a carrier cell line as mobile', () => {
    expect(phoneLineKind('mobile')).toBe('mobile')
  })
  it('groups landline and cable-company home service as one home phone', () => {
    expect(phoneLineKind('landline')).toBe('home')
    expect(phoneLineKind('fixedVoip')).toBe('home')
  })
  it('labels burner-app numbers as virtual', () => {
    expect(phoneLineKind('nonFixedVoip')).toBe('virtual')
  })
  it('labels nothing when the lookup is missing or a type we do not name', () => {
    expect(phoneLineKind(null)).toBe(null)
    expect(phoneLineKind(undefined)).toBe(null)
    expect(phoneLineKind('')).toBe(null)
    expect(phoneLineKind('tollFree')).toBe(null)
    expect(phoneLineKind('voicemail')).toBe(null)
    expect(phoneLineKind('unknown')).toBe(null)
  })
})

describe('twilioStatusCallbackUrl', () => {
  it('rewrites the apex domain to www so the callback never hits the 307 redirect', () => {
    expect(twilioStatusCallbackUrl('https://ohaccess.com')).toBe(
      'https://www.ohaccess.com/api/webhooks/twilio-status'
    )
  })
  it('leaves the www domain untouched', () => {
    expect(twilioStatusCallbackUrl('https://www.ohaccess.com')).toBe(
      'https://www.ohaccess.com/api/webhooks/twilio-status'
    )
  })
  it('leaves other origins (local dev) untouched and strips a trailing slash', () => {
    expect(twilioStatusCallbackUrl('http://localhost:3000/')).toBe(
      'http://localhost:3000/api/webhooks/twilio-status'
    )
  })
})

describe('normalizeDisclosureLinks', () => {
  it('keeps well-formed rows and trims the label', () => {
    expect(normalizeDisclosureLinks([{ label: '  IABS  ', url: 'https://example.com/iabs.pdf' }]))
      .toEqual([{ label: 'IABS', url: 'https://example.com/iabs.pdf' }])
  })
  it('returns [] for null/undefined/non-array (empty or never-set column)', () => {
    expect(normalizeDisclosureLinks(null)).toEqual([])
    expect(normalizeDisclosureLinks(undefined)).toEqual([])
    expect(normalizeDisclosureLinks('nope')).toEqual([])
    expect(normalizeDisclosureLinks({ label: 'x', url: 'https://a.com' })).toEqual([])
  })
  it('drops rows with a blank label or a non-https url', () => {
    expect(normalizeDisclosureLinks([
      { label: '', url: 'https://example.com/a.pdf' },
      { label: '   ', url: 'https://example.com/b.pdf' },
      { label: 'Insecure', url: 'http://example.com/c.pdf' },
      { label: 'Relative', url: '/local/d.pdf' },
      { label: 'Good', url: 'https://example.com/e.pdf' },
    ])).toEqual([{ label: 'Good', url: 'https://example.com/e.pdf' }])
  })
  it('refuses javascript: and data: urls even when dressed up', () => {
    expect(normalizeDisclosureLinks([
      { label: 'XSS', url: 'javascript:alert(1)' },
      { label: 'Data', url: 'data:text/html,<script>alert(1)</script>' },
      { label: 'Sneaky', url: ' javascript:alert(1)' },
    ])).toEqual([])
  })
  it('drops malformed entries without throwing', () => {
    expect(normalizeDisclosureLinks([null, 42, 'str', {}, { label: 5, url: 7 }])).toEqual([])
  })
  it('caps the list at MAX_DISCLOSURE_LINKS', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ label: `Doc ${i}`, url: `https://e.com/${i}` }))
    expect(normalizeDisclosureLinks(many)).toHaveLength(MAX_DISCLOSURE_LINKS)
  })
  it('caps an over-long label', () => {
    const [row] = normalizeDisclosureLinks([{ label: 'x'.repeat(500), url: 'https://e.com/a' }])
    expect(row.label).toHaveLength(MAX_DISCLOSURE_LABEL_LENGTH)
  })
})

describe('resolveDisclosureLinks', () => {
  const agent = [{ label: 'Agent doc', url: 'https://e.com/agent' }]
  const brokerage = [{ label: 'Brokerage doc', url: 'https://e.com/brokerage' }]

  it("uses the agent's own links when they have no brokerage", () => {
    expect(resolveDisclosureLinks(agent, null)).toEqual(agent)
  })
  it('lets the brokerage override the agent (broker-level control)', () => {
    expect(resolveDisclosureLinks(agent, brokerage)).toEqual(brokerage)
  })
  it('falls through to the agent when the brokerage has configured nothing', () => {
    expect(resolveDisclosureLinks(agent, [])).toEqual(agent)
    expect(resolveDisclosureLinks(agent, null)).toEqual(agent)
  })
  it('falls through to the agent when every brokerage row is invalid', () => {
    expect(resolveDisclosureLinks(agent, [{ label: 'Bad', url: 'http://e.com' }])).toEqual(agent)
  })
  it('returns [] when neither side has anything', () => {
    expect(resolveDisclosureLinks(null, null)).toEqual([])
  })
})

describe('buildDisclosuresHtml', () => {
  it('renders nothing when there are no links, so the email omits the section', () => {
    expect(buildDisclosuresHtml([])).toBe('')
  })
  it('renders one anchor per link', () => {
    const html = buildDisclosuresHtml([
      { label: 'IABS', url: 'https://e.com/iabs.pdf' },
      { label: 'Consumer Notice', url: 'https://e.com/cn.pdf' },
    ])
    expect(html).toContain('href="https://e.com/iabs.pdf"')
    expect(html).toContain('>IABS<')
    expect(html).toContain('>Consumer Notice<')
  })
  it('escapes an agent-entered label so it cannot inject markup', () => {
    const html = buildDisclosuresHtml([
      { label: '<img src=x onerror=alert(1)>', url: 'https://e.com/a.pdf' },
    ])
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
  it('escapes quotes in the url so it cannot break out of the href attribute', () => {
    const html = buildDisclosuresHtml([
      { label: 'Doc', url: 'https://e.com/a.pdf?x="onmouseover="alert(1)' },
    ])
    expect(html).not.toContain('"onmouseover="')
  })
})
