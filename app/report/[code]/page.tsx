import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { buildSellerReportStats } from '@/lib/seller-report'
import { safeUrl } from '@/lib/register-helpers'
import { onColor, readableOnLight } from '@/lib/colors'
import ShareLink from './ShareLink'

// The shareable seller report card: a PII-free summary of one open house
// (visitor count, buyer timelines, scan funnel) that the hosting agent sends
// to their seller. Reachable only by its /report/<code> link; shows counts
// and timelines, never visitor names or contact info. The short_urls row
// rides the open-house delete cascade, so the link dies with the event.

// Per-report link previews: when an agent texts the report to their seller,
// the card shows the property address instead of the generic site preview.
// Stays noindex — reachable by link only. Falls back to a generic title on
// unknown codes.
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const generic: Metadata = {
    title: 'Open House Report',
    robots: { index: false, follow: false },
  }

  const { data: link } = await supabase
    .from('short_urls')
    .select('open_house_id')
    .eq('code', code)
    .eq('url_type', 'seller_report')
    .maybeSingle()
  if (!link?.open_house_id) return generic

  const { data: oh } = await supabase
    .from('open_houses')
    .select('property_address')
    .eq('id', link.open_house_id)
    .maybeSingle()
  if (!oh?.property_address) return generic

  const title = `Open House Report — ${oh.property_address}`
  const description =
    'Verified visitor turnout and buyer timelines for this open house, powered by ohACCESS.'
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `https://www.ohaccess.com/report/${code}`,
      type: 'website',
      images: [{ url: 'https://www.ohaccess.com/og-image.jpg', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', images: ['https://www.ohaccess.com/og-image.jpg'] },
  }
}

const FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"

function NotAvailable({ rateLimited = false }: { rateLimited?: boolean }) {
  return (
    <div style={{ background: '#f5f5f7', minHeight: '100vh', fontFamily: FONT }}>
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '48px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: '#1d1d1f' }}>
          oh<span style={{ fontWeight: 300 }}>ACCESS</span>
        </div>
        <div style={{ background: 'white', border: '1px solid #d1d1d6', borderRadius: 18, padding: '36px 24px', marginTop: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1d1d1f' }}>
            {rateLimited ? 'One moment' : "This report isn't available"}
          </div>
          <div style={{ fontSize: 13, color: '#6e6e73', marginTop: 8, lineHeight: 1.5 }}>
            {rateLimited
              ? 'This page is getting a lot of requests right now — please try again in a few minutes.'
              : 'The link may be incorrect, or the open house it belonged to has been removed.'}
          </div>
        </div>
      </main>
    </div>
  )
}

export default async function SellerReportPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  // Same public-page rate limiting as /map/[code]'s API — a wrong code shows
  // the friendly not-available page, and guessing is throttled per IP.
  const h = await headers()
  const ip = (h.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
  const limit = await checkRateLimit(`ip:${ip}`, 'seller-report', 60, 3600)
  if (!limit.allowed) return <NotAvailable rateLimited />

  const { data: link } = await supabase
    .from('short_urls')
    .select('open_house_id')
    .eq('code', code)
    .eq('url_type', 'seller_report')
    .maybeSingle()
  if (!link?.open_house_id) return <NotAvailable />

  const { data: oh } = await supabase
    .from('open_houses')
    .select('id, property_address, open_house_date, open_house_hours, listing_url, agent_id')
    .eq('id', link.open_house_id)
    .maybeSingle()
  if (!oh) return <NotAvailable />

  const [{ data: visitors }, { count: scanCount }, { data: agent }] = await Promise.all([
    supabase.from('visitors').select('purchasing_timeline, feedback_rating, feedback_price, custom_answers').eq('open_house_id', oh.id),
    supabase.from('qr_scans').select('id', { count: 'exact', head: true }).eq('open_house_id', oh.id),
    supabase
      .from('profiles')
      .select('full_name, email, display_email, phone, brokerage, brokerage_id, primary_color, accent_color, logo_url, headshot_url, custom_questions')
      .eq('id', oh.agent_id)
      .maybeSingle(),
  ])

  // Team/brokerage members inherit their team's branding, matching every
  // other visitor-facing surface (register page, emails, printed sign).
  let brandColor = agent?.primary_color || '#1d1d1f'
  let accentColor = agent?.accent_color || '#0071e3'
  let brandLogo = safeUrl(agent?.logo_url)
  if (agent?.brokerage_id) {
    const { data: brokerage } = await supabase
      .from('brokerages')
      .select('primary_color, accent_color, logo_url')
      .eq('id', agent.brokerage_id)
      .maybeSingle()
    if (brokerage?.primary_color) brandColor = brokerage.primary_color
    if (brokerage?.accent_color) accentColor = brokerage.accent_color
    if (safeUrl(brokerage?.logo_url)) brandLogo = safeUrl(brokerage?.logo_url)
  }
  const listingUrl = safeUrl(oh.listing_url)

  // Stats and chart bars alternate between the agent's two brand colors —
  // primary first, then accent — instead of per-answer semantic colors.
  // readableOnLight guards against a too-light pick vanishing on white.
  const chartPrimary = readableOnLight(brandColor)
  const chartAccent = readableOnLight(accentColor)
  const chartColor = (i: number) => (i % 2 === 0 ? chartPrimary : chartAccent)

  const stats = buildSellerReportStats(visitors ?? [], scanCount ?? 0, agent?.custom_questions)
  const agentContactEmail = agent?.display_email || agent?.email || null
  const agentHeadshot = safeUrl(agent?.headshot_url)

  return (
    // White at the top fading into the usual page gray — brokerage logos are
    // drawn for white backgrounds, so the logo floats on the white zone above
    // the branded card instead of inside it (per Dave).
    <div style={{ background: 'linear-gradient(#ffffff 0px, #ffffff 120px, #f5f5f7 300px)', backgroundColor: '#f5f5f7', minHeight: '100vh', fontFamily: FONT, color: '#1d1d1f' }}>
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '28px 16px 48px' }}>

        {/* Brokerage/agent logo, centered above the card on the white zone */}
        {brandLogo && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandLogo} alt="" style={{ maxHeight: 56, maxWidth: 220, objectFit: 'contain', display: 'inline-block' }} />
          </div>
        )}

        {/* Branded header */}
        <div style={{ background: brandColor, borderRadius: 18, padding: '24px 22px', color: 'white' }}>
          {!brandLogo && (
            <div style={{ fontSize: 18, fontWeight: 200, letterSpacing: -0.5, marginBottom: 10 }}>
              oh<span style={{ fontWeight: 700 }}>ACCESS</span>
            </div>
          )}
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Open House Report</div>
          <div style={{ fontSize: 14, opacity: 0.85, marginTop: 6 }}>{oh.property_address}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            {[oh.open_house_date, oh.open_house_hours].filter(Boolean).join(' · ')}
          </div>
        </div>

        {/* Headline stats */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1, background: 'white', border: '1px solid #d1d1d6', borderRadius: 14, padding: '18px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, color: chartPrimary }}>{stats.total}</div>
            <div style={{ fontSize: 11, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
              Registered {stats.total === 1 ? 'visitor' : 'visitors'}
            </div>
          </div>
          {stats.soonCount > 0 && (
            <div style={{ flex: 1, background: 'white', border: '1px solid #d1d1d6', borderRadius: 14, padding: '18px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, color: chartAccent }}>{stats.soonCount}</div>
              <div style={{ fontSize: 11, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
                Buying within 6 months
              </div>
            </div>
          )}
        </div>

        {stats.total > 0 ? (
          <>
            <div style={{ background: '#e8f9ee', border: '1px solid #b2f0c8', borderRadius: 12, padding: '11px 14px', marginTop: 10, fontSize: 12.5, color: '#1a7a3c', fontWeight: 600, lineHeight: 1.45 }}>
              ✓ Every visitor&apos;s phone and email were verified at sign-in with a one-time
              code — no bad numbers, no unreadable sign-in sheets.
            </div>

            {/* Timeline breakdown */}
            <div style={{ background: 'white', border: '1px solid #d1d1d6', borderRadius: 14, padding: '18px 20px', marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                When visitors plan to buy
              </div>
              {stats.groups.map((g, i) => {
                const c = chartColor(i)
                const pct = Math.round((g.count / stats.total) * 100)
                return (
                  <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <span style={{ background: c, color: onColor(c), padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', minWidth: 92, textAlign: 'center' }}>
                      {g.label}
                    </span>
                    <div style={{ flex: 1, background: '#f2f2f7', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(pct, 4)}%`, height: '100%', background: c, borderRadius: 6 }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: 'right' }}>{g.count}</span>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div style={{ background: 'white', border: '1px solid #d1d1d6', borderRadius: 14, padding: '22px 20px', marginTop: 10, fontSize: 13, color: '#6e6e73', textAlign: 'center' }}>
            No registrations were recorded for this event.
          </div>
        )}

        {/* Scan funnel — only when the scan log covers this event */}
        {stats.funnel && (
          <div style={{ background: 'white', border: '1px solid #d1d1d6', borderRadius: 14, padding: '16px 20px', marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Interest at the door
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <strong>{stats.funnel.scans}</strong> {stats.funnel.scans === 1 ? 'person' : 'people'} scanned
              the QR code · <strong>{stats.funnel.registered}</strong> completed registration
            </div>
          </div>
        )}

        {/* What visitors thought — post-visit feedback, aggregate only */}
        {stats.feedback && (
          <div style={{ background: 'white', border: '1px solid #d1d1d6', borderRadius: 14, padding: '18px 20px', marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              What visitors thought
            </div>

            {/* Overall rating */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>{stats.feedback.avgRating.toFixed(1)}</div>
              <div style={{ fontSize: 15, color: '#6e6e73', fontWeight: 600 }}>/ 10</div>
            </div>
            <div style={{ fontSize: 11, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Average overall rating · {stats.feedback.responses} {stats.feedback.responses === 1 ? 'response' : 'responses'}
            </div>

            {/* Price sentiment */}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 0.5, margin: '16px 0 8px' }}>
              How visitors felt about the price
            </div>
            {([
              { label: 'Too high', count: stats.feedback.price.high },
              { label: 'Reasonable', count: stats.feedback.price.reasonable },
              { label: 'Too low', count: stats.feedback.price.low },
            ] as const).map((row, i) => {
              const pct = stats.feedback!.responses > 0 ? Math.round((row.count / stats.feedback!.responses) * 100) : 0
              return (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 92 }}>{row.label}</span>
                  <div style={{ flex: 1, background: '#f2f2f7', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${row.count > 0 ? Math.max(pct, 4) : 0}%`, height: '100%', background: chartColor(i), borderRadius: 6 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: 'right' }}>{row.count}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* The agent's own custom questions — one card per question that got
            answers. Choice questions show a count per option; free-text
            questions list the visitors' words with no identity attached. */}
        {stats.customQuestions.map(q => {
          return (
            <div key={q.id} style={{ background: 'white', border: '1px solid #d1d1d6', borderRadius: 14, padding: '18px 20px', marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {q.prompt}
              </div>
              {q.choices ? (
                q.choices.map((c, i) => {
                  const pct = q.responses > 0 ? Math.round((c.count / q.responses) * 100) : 0
                  return (
                    <div key={c.label} style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{c.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{c.count}</span>
                      </div>
                      <div style={{ background: '#f2f2f7', borderRadius: 6, height: 8, overflow: 'hidden', marginTop: 4 }}>
                        <div style={{ width: `${c.count > 0 ? Math.max(pct, 4) : 0}%`, height: '100%', background: chartColor(i), borderRadius: 6 }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                q.answers.map((a, i) => (
                  <div key={i} style={{ background: '#f5f5f7', borderRadius: 10, padding: '9px 12px', marginTop: i === 0 ? 12 : 8, fontSize: 13, lineHeight: 1.5 }}>
                    &ldquo;{a}&rdquo;
                  </div>
                ))
              )}
              <div style={{ fontSize: 11, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 }}>
                {q.responses} {q.responses === 1 ? 'response' : 'responses'}
              </div>
            </div>
          )
        })}

        {/* Prepared by */}
        {agent?.full_name && (
          <div style={{ background: 'white', border: '1px solid #d1d1d6', borderRadius: 14, padding: '16px 20px', marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Hosted by
            </div>
            {/* Same layout as the agent card in the codeword email: round
                headshot on the left, contact details stacked beside it. */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {agentHeadshot && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agentHeadshot} alt="" style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #d1d1d6', marginRight: 20 }} />
              )}
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{agent.full_name}</div>
                {agent.brokerage && <div style={{ fontSize: 12.5, color: '#6e6e73', marginTop: 2 }}>{agent.brokerage}</div>}
                {agentContactEmail && <div style={{ marginTop: 2 }}><a href={`mailto:${agentContactEmail}`} style={{ fontSize: 12.5, color: brandColor, fontWeight: 600, textDecoration: 'none' }}>{agentContactEmail}</a></div>}
                {agent.phone && <div style={{ marginTop: 2 }}><a href={`tel:${agent.phone}`} style={{ fontSize: 12.5, color: brandColor, fontWeight: 600, textDecoration: 'none' }}>{agent.phone}</a></div>}
                {listingUrl && (
                  <div style={{ marginTop: 2 }}>
                    <a href={listingUrl} style={{ fontSize: 12.5, color: brandColor, fontWeight: 700 }}>View the listing →</a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <ShareLink
          url={`https://www.ohaccess.com/report/${code}`}
          title={`Open House Report — ${oh.property_address}`}
        />

        <div style={{ textAlign: 'center', marginTop: 22, fontSize: 11, color: '#aeaeb2' }}>
          Powered by <a href="https://www.ohaccess.com" style={{ color: '#6e6e73', fontWeight: 700, textDecoration: 'none' }}>ohACCESS.com</a> · Patent Pending
          <div style={{ marginTop: 3 }}>Visitor identities verified · Contact details are shared only with the hosting agent</div>
        </div>
      </main>
    </div>
  )
}
