import { supabaseAdmin as supabase } from './supabase-admin'
import { buildUpcomingOpenHousesHtml } from './register-helpers'
import { buildThankYouEmail, exampleUpcomingOpenHouses, type ThankYouSponsorCard } from './thank-you-email'
import { resolveEmailBranding, listingFacts, loadUpcomingOpenHouses } from './thank-you-data'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ohaccess.com'

export type ThankYouPreview = {
  subject: string
  html: string
  visitorFirst: string | null
  visitors: number
  sent: number
  upcomingCount: number
  usingExamples: boolean
}

// The dashboard's "✉️ Visitor email" preview. Builds the next-morning
// thank-you email for one of the agent's open houses exactly the way the cron
// does (same builder, same branding + upcoming-open-houses data), addressed to
// the most recent visitor who actually got it (or a sample visitor). When the
// agent has no upcoming open houses to list, two clearly-marked example ones
// fill the section so they can see what visitors would get if they scheduled.
// Read-only; nothing is sent. Returns null when the open house is missing or
// not the agent's (callers 404 both, so existence isn't confirmed).
export async function buildThankYouPreview(ohId: string, agentId: string): Promise<ThankYouPreview | null> {
  const { data: oh } = await supabase.from('open_houses')
    .select('id, agent_id, street_address, property_address, city, state, timezone, start_at, listing_url, listing_price, bedrooms, bathrooms, square_footage, country')
    .eq('id', ohId)
    .maybeSingle()
  if (!oh || oh.agent_id !== agentId) return null

  const { data: agent } = await supabase.from('profiles')
    .select('id, full_name, email, display_email, phone, brokerage, brokerage_id, primary_color, accent_color, logo_url, headshot_url')
    .eq('id', agentId)
    .maybeSingle()
  if (!agent) return null

  const { data: brokerage } = agent.brokerage_id
    ? await supabase.from('brokerages').select('id, name, primary_color, accent_color, logo_url').eq('id', agent.brokerage_id).maybeSingle()
    : { data: null }

  // Whose copy to show: the latest visitor who was sent it, else the latest
  // visitor (theirs hasn't gone out yet), else a sample name.
  const [{ data: sentRows }, { data: latestRows }, { count: visitorCount }, { count: sentCount }] = await Promise.all([
    supabase.from('visitors').select('first_name, registered_at, sponsor_id')
      .eq('open_house_id', ohId).not('thank_you_sent_at', 'is', null)
      .order('thank_you_sent_at', { ascending: false }).limit(1),
    supabase.from('visitors').select('first_name, registered_at, sponsor_id')
      .eq('open_house_id', ohId)
      .order('registered_at', { ascending: false }).limit(1),
    supabase.from('visitors').select('id', { count: 'exact', head: true }).eq('open_house_id', ohId),
    supabase.from('visitors').select('id', { count: 'exact', head: true }).eq('open_house_id', ohId).not('thank_you_sent_at', 'is', null),
  ])
  const visitor = sentRows?.[0] ?? latestRows?.[0] ?? null

  let sponsor: ThankYouSponsorCard | null = null
  if (visitor?.sponsor_id) {
    const { data: s } = await supabase.from('sponsors')
      .select('full_name, company, display_email, phone, logo_url')
      .eq('id', visitor.sponsor_id).maybeSingle()
    if (s?.full_name) sponsor = { name: s.full_name, company: s.company, email: s.display_email, phone: s.phone, logoUrl: s.logo_url }
  }

  const { primary, accent, onPrimary, onAccent, logoUrl } = resolveEmailBranding(agent, brokerage ?? undefined)

  const upcoming = await loadUpcomingOpenHouses(supabase, agent, oh, ohId)
  const usingExamples = upcoming.length === 0
  let upcomingHtml = buildUpcomingOpenHousesHtml(usingExamples ? exampleUpcomingOpenHouses(oh, new Date()) : upcoming, APP_URL)
  if (usingExamples) {
    upcomingHtml = `
          <div style="border:2px dashed ${accent};border-radius:12px;padding:12px 10px 0;margin:22px 0 16px;">
            <div style="text-align:center;margin:-24px 0 8px;"><span style="background:${accent};color:${onAccent};font-size:11px;font-weight:800;letter-spacing:0.5px;padding:4px 10px;border-radius:20px;">EXAMPLE: your scheduled open houses show here</span></div>
            ${upcomingHtml}
          </div>`
  }

  const street = oh.street_address || oh.property_address || 'the open house'
  const { html, subject } = buildThankYouEmail({
    appUrl: APP_URL,
    primary, accent, onPrimary, onAccent,
    visitorFirst: visitor?.first_name || 'Sarah',
    street, city: oh.city, fullAddress: oh.property_address || street,
    dateLabel: fmtDate(visitor?.registered_at || oh.start_at || new Date().toISOString(), oh.timezone),
    agentName: agent.full_name || 'your agent',
    brokerage: agent.brokerage || null,
    headshotUrl: agent.headshot_url, agentLogoUrl: logoUrl,
    agentPhone: agent.phone,
    agentEmail: agent.display_email || agent.email || 'support@ohaccess.com',
    listingUrl: oh.listing_url,
    facts: listingFacts(oh),
    // Placeholder: a real visitor's feedback link would let the agent answer
    // on their behalf. Links are inert in the preview anyway (style below).
    feedbackUrl: `${APP_URL}/feedback/preview`,
    upcomingHtml,
    sponsor,
  })

  return {
    subject,
    // Preview-only: disable every link so nothing is clicked through by accident.
    html: html.replace('</head>', '<style>a{pointer-events:none;cursor:default;}</style></head>'),
    visitorFirst: visitor?.first_name || null,
    visitors: visitorCount ?? 0,
    sent: sentCount ?? 0,
    upcomingCount: upcoming.length,
    usingExamples,
  }
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
