import { supabaseAdmin as supabase } from './supabase-admin'
import { buildUpcomingOpenHousesHtml, resolveDisclosureLinks, isHttpUrl } from './register-helpers'
import { buildThankYouEmail, exampleUpcomingOpenHouses, type ThankYouSponsorCard } from './thank-you-email'
import { buildCodewordEmail, type CodewordSponsor } from './codeword-email'
import { buildInviteEmail } from './invite-helpers'
import { resolveEmailBranding, listingFacts, loadUpcomingOpenHouses } from './thank-you-data'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

type EmailPreview = { subject: string; html: string }

export type VisitorEmailPreviews = {
  visitors: number          // sign-ins at this open house
  upcomingCount: number     // real upcoming open houses listed in the emails
  usingExamples: boolean    // none → example open houses fill that section
  codeword: EmailPreview
  thankYou: EmailPreview & { visitorFirst: string | null; sent: number }
  invite: EmailPreview & {
    invitesSent: number                        // all invites this agent has sent
    target: 'this' | 'next' | 'example'        // which open house the invite is for
    targetAddress: string
  }
}

// The dashboard's "✉️ Visitor emails" preview: the three emails a visitor can
// get, for one of the agent's open houses, built with the SAME builders and
// data as the real sends (codeword at sign-in, thank-you the next morning,
// invite when the agent sends one). Read-only: nothing is sent, no tracked
// short links are minted, and a visitor's real feedback/unsubscribe tokens
// are never used. When the agent has no upcoming open houses, clearly-marked
// example ones stand in so they can see what visitors would get if they did.
// Returns null when the open house is missing or not the agent's (callers 404
// both, so existence isn't confirmed).
export async function buildVisitorEmailPreviews(ohId: string, agentId: string): Promise<VisitorEmailPreviews | null> {
  const { data: oh } = await supabase.from('open_houses')
    .select('id, agent_id, street_address, property_address, city, state, timezone, start_at, end_at, open_house_date, open_house_hours, code_word, code_word_email, listing_url, listing_price, bedrooms, bathrooms, square_footage, country')
    .eq('id', ohId)
    .maybeSingle()
  if (!oh || oh.agent_id !== agentId) return null

  const { data: agent } = await supabase.from('profiles')
    .select('id, full_name, email, display_email, phone, brokerage, brokerage_id, primary_color, accent_color, logo_url, headshot_url, license_number, state, landing_page_url, sponsor_id, disclosure_links')
    .eq('id', agentId)
    .maybeSingle()
  if (!agent) return null

  const { data: brokerage } = agent.brokerage_id
    ? await supabase.from('brokerages').select('id, name, primary_color, accent_color, logo_url, disclosure_links').eq('id', agent.brokerage_id).maybeSingle()
    : { data: null }

  // Whose thank-you to show: the latest visitor who was sent it, else the
  // latest visitor (theirs hasn't gone out yet), else a sample name.
  const [{ data: sentRows }, { data: latestRows }, { count: visitorCount }, { count: sentCount }, { count: invitesSent }] = await Promise.all([
    supabase.from('visitors').select('first_name, registered_at, sponsor_id')
      .eq('open_house_id', ohId).not('thank_you_sent_at', 'is', null)
      .order('thank_you_sent_at', { ascending: false }).limit(1),
    supabase.from('visitors').select('first_name, registered_at, sponsor_id')
      .eq('open_house_id', ohId)
      .order('registered_at', { ascending: false }).limit(1),
    supabase.from('visitors').select('id', { count: 'exact', head: true }).eq('open_house_id', ohId),
    supabase.from('visitors').select('id', { count: 'exact', head: true }).eq('open_house_id', ohId).not('thank_you_sent_at', 'is', null),
    supabase.from('visitor_invites').select('id', { count: 'exact', head: true }).eq('agent_id', agentId),
  ])
  const visitor = sentRows?.[0] ?? latestRows?.[0] ?? null

  const { primary, accent, onPrimary, onAccent, logoUrl } = resolveEmailBranding(agent, brokerage ?? undefined)

  // "Upcoming Open Houses" — shared by the codeword and thank-you emails.
  const upcoming = await loadUpcomingOpenHouses(supabase, agent, oh, ohId)
  const usingExamples = upcoming.length === 0
  let upcomingHtml = buildUpcomingOpenHousesHtml(usingExamples ? exampleUpcomingOpenHouses(oh, new Date()) : upcoming, APP_URL, accent)
  if (usingExamples) {
    upcomingHtml = `
          <div style="border:2px dashed ${accent};border-radius:12px;padding:12px 10px 0;margin:22px 0 16px;">
            <div style="text-align:center;margin:-24px 0 8px;"><span style="background:${accent};color:${onAccent};font-size:11px;font-weight:800;letter-spacing:0.5px;padding:4px 10px;border-radius:20px;">EXAMPLE: your scheduled open houses show here</span></div>
            ${upcomingHtml}
          </div>`
  }

  const street = oh.street_address || oh.property_address || 'the open house'
  const agentEmail = agent.display_email || agent.email || 'support@ohaccess.com'

  // ① Codeword email (at sign-in). The agent's current sponsor, as the sign-in
  // send looks it up; raw links stand in for the tracked short links.
  let agentSponsor: CodewordSponsor | null = null
  if (agent.sponsor_id) {
    const { data: s } = await supabase.from('sponsors')
      .select('id, full_name, company, display_email, phone, license_number, headshot_url, logo_url, landing_page_url')
      .eq('id', agent.sponsor_id).maybeSingle()
    if (s?.full_name) agentSponsor = s
  }
  const codeword = buildCodewordEmail({
    openHouse: oh,
    agent,
    brokerageRow: brokerage ?? null,
    sponsor: agentSponsor,
    disclosureLinks: resolveDisclosureLinks(agent.disclosure_links, brokerage?.disclosure_links),
    listingShortUrl: isHttpUrl(oh.listing_url) ? oh.listing_url : null,
    agentShortUrl: isHttpUrl(agent.landing_page_url) ? agent.landing_page_url : null,
    sponsorShortUrl: agentSponsor && isHttpUrl(agentSponsor.landing_page_url) ? agentSponsor.landing_page_url : null,
    upcomingHtml,
  })

  // ② Thank-you email (next morning).
  let visitSponsor: ThankYouSponsorCard | null = null
  if (visitor?.sponsor_id) {
    const { data: s } = await supabase.from('sponsors')
      .select('full_name, company, display_email, phone, license_number, headshot_url, logo_url, landing_page_url')
      .eq('id', visitor.sponsor_id).maybeSingle()
    if (s?.full_name) {
      visitSponsor = {
        name: s.full_name, company: s.company, email: s.display_email, phone: s.phone,
        licenseNumber: s.license_number, headshotUrl: s.headshot_url, logoUrl: s.logo_url,
        infoUrl: isHttpUrl(s.landing_page_url) ? s.landing_page_url : null,
      }
    }
  }
  const thankYou = buildThankYouEmail({
    appUrl: APP_URL,
    primary, accent, onPrimary, onAccent,
    visitorFirst: visitor?.first_name || 'Sarah',
    street, city: oh.city, fullAddress: oh.property_address || street,
    dateLabel: fmtDate(visitor?.registered_at || oh.start_at || new Date().toISOString(), oh.timezone),
    agentName: agent.full_name || 'your agent',
    brokerage: agent.brokerage || null,
    headshotUrl: agent.headshot_url, agentLogoUrl: logoUrl,
    agentPhone: agent.phone,
    agentEmail,
    agentLicenseNumber: agent.license_number,
    agentLicenseState: agent.state,
    agentInfoUrl: isHttpUrl(agent.landing_page_url) ? agent.landing_page_url : null,
    listingUrl: oh.listing_url,
    facts: listingFacts(oh),
    // Placeholder: a real visitor's feedback link would let the agent answer
    // on their behalf.
    feedbackUrl: `${APP_URL}/feedback/preview`,
    upcomingHtml,
    sponsor: visitSponsor,
  })

  // ③ Invite email (sent when the agent clicks 💌 Invite). For an open house
  // that hasn't ended: the invite for THIS one, to someone who visited the
  // agent's latest past open house. For an ended one: the invite this home's
  // visitors would get for the agent's next open house, or an example one.
  type InviteTarget = {
    id: string; street_address: string | null; property_address: string | null
    open_house_date: string | null; open_house_hours: string | null
    start_at: string | null; end_at: string | null; timezone: string | null
    listing_price: string | null; bedrooms: string | null; bathrooms: string | null; listing_url: string | null
  }
  let target: InviteTarget
  let targetKind: 'this' | 'next' | 'example'
  let pastStreet: string | null
  let inviteeFirst = visitor?.first_name || 'Sarah'
  if (!hasEnded(oh)) {
    target = oh
    targetKind = 'this'
    const { data: past } = await supabase.from('open_houses')
      .select('id, street_address, property_address')
      .eq('agent_id', agentId).neq('id', ohId).lt('start_at', new Date().toISOString())
      .order('start_at', { ascending: false }).limit(1)
    const p = past?.[0]
    pastStreet = p ? (p.street_address || p.property_address) : null
    inviteeFirst = 'Sarah'
    if (p) {
      const { data: pv } = await supabase.from('visitors').select('first_name')
        .eq('open_house_id', p.id).order('registered_at', { ascending: false }).limit(1)
      inviteeFirst = pv?.[0]?.first_name || 'Sarah'
    }
  } else {
    pastStreet = street
    const { data: next } = await supabase.from('open_houses')
      .select('id, street_address, property_address, open_house_date, open_house_hours, start_at, end_at, timezone, listing_price, bedrooms, bathrooms, listing_url')
      .eq('agent_id', agentId).neq('id', ohId).gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true }).limit(1)
    if (next?.[0]) {
      target = next[0]
      targetKind = 'next'
    } else {
      const ex = exampleUpcomingOpenHouses(oh, new Date())[0]
      target = { ...ex, street_address: null, timezone: null, listing_url: null }
      targetKind = 'example'
    }
  }
  const targetStreet = target.street_address || (target.property_address || '').split(',')[0] || 'the property'
  const inviteFacts = [
    target.listing_price ? String(target.listing_price) : '',
    target.bedrooms ? `${target.bedrooms} bd` : '',
    target.bathrooms ? `${target.bathrooms} ba` : '',
  ].filter(Boolean).join(' · ')
  const invite = buildInviteEmail({
    appUrl: APP_URL,
    primary, accent, onPrimary, onAccent,
    visitorFirst: inviteeFirst,
    pastStreet,
    agentName: agent.full_name || 'your agent',
    brokerage: agent.brokerage || null,
    headshotUrl: agent.headshot_url || null,
    agentLogoUrl: logoUrl,
    agentLicenseNumber: agent.license_number || null,
    agentLicenseState: agent.state || null,
    agentInfoUrl: isHttpUrl(agent.landing_page_url) ? agent.landing_page_url : null,
    agentPhone: agent.phone || null,
    agentEmail,
    oh: {
      id: target.id,
      fullAddress: target.property_address || targetStreet,
      street: targetStreet,
      dateLabel: inviteDateLabel(target),
      hoursLabel: target.open_house_hours,
      startAt: target.start_at,
      endAt: target.end_at,
      facts: inviteFacts || null,
      listingUrl: target.listing_url,
    },
    // Placeholder: never a real visitor's unsubscribe token.
    unsubscribeUrl: `${APP_URL}/unsubscribe?token=preview`,
  })

  return {
    visitors: visitorCount ?? 0,
    upcomingCount: upcoming.length,
    usingExamples,
    codeword: { subject: codeword.subject, html: inert(codeword.html) },
    thankYou: { subject: thankYou.subject, html: inert(thankYou.html), visitorFirst: visitor?.first_name || null, sent: sentCount ?? 0 },
    invite: {
      subject: invite.subject, html: inert(invite.html),
      invitesSent: invitesSent ?? 0,
      target: targetKind,
      targetAddress: target.property_address || targetStreet,
    },
  }
}

// Preview-only: disable every link so nothing is clicked through by accident.
// The codeword email is a bare fragment (no <head>), so prepend there.
function inert(html: string): string {
  const style = '<style>a{pointer-events:none;cursor:default;}</style>'
  return html.includes('</head>') ? html.replace('</head>', `${style}</head>`) : style + html
}

// Same rule as the invites route: an invite only makes sense before the end.
function hasEnded(oh: { end_at: string | null; open_house_date: string | null }): boolean {
  if (oh.end_at) return Date.now() > new Date(oh.end_at).getTime()
  if (oh.open_house_date) {
    const t = Date.parse(oh.open_house_date)
    if (!Number.isNaN(t)) {
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
      return t < startOfToday.getTime()
    }
  }
  return false
}

// "Sat, Aug 1" in the property's timezone, as the invites route labels it.
function inviteDateLabel(oh: { start_at: string | null; timezone: string | null; open_house_date: string | null }): string {
  if (oh.start_at) {
    try {
      return new Date(oh.start_at).toLocaleDateString('en-US', {
        ...(oh.timezone ? { timeZone: oh.timezone } : {}),
        weekday: 'short', month: 'short', day: 'numeric',
      })
    } catch { /* fall through to the stored label */ }
  }
  return oh.open_house_date || ''
}

function fmtDate(iso: string, tz: string | null): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      ...(tz ? { timeZone: tz } : {}),
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch {
    return new Date(iso).toLocaleDateString('en-US')
  }
}
