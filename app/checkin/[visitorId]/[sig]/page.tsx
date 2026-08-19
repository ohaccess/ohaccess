import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { verifyCodewordLink } from '@/lib/codeword-link'
import { isLightColor, onColor, readableOnLight } from '@/lib/colors'

// The page behind the link in the WhatsApp codeword message (see
// lib/codeword-link.ts for why WhatsApp gets a link instead of the word).
// Shows the visitor their codeword(s) for the open house they just signed in
// to — the same two words the SMS and email carry — so they can read it to
// the host at the door.
//
// Reachable only with the HMAC-signed link that was delivered to the
// visitor's WhatsApp number; a wrong or missing signature is a plain 404
// (never a hint). Service-role read, safe fields only. noindex.

export const metadata: Metadata = {
  title: 'Your codeword',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function CheckinDetailsPage({
  params,
}: {
  params: Promise<{ visitorId: string; sig: string }>
}) {
  const { visitorId, sig } = await params
  if (!UUID_RE.test(visitorId) || !verifyCodewordLink(visitorId, sig)) notFound()

  const { data: visitor } = await supabase
    .from('visitors')
    .select('id, first_name, open_house_id, agent_id')
    .eq('id', visitorId)
    .maybeSingle()
  if (!visitor?.open_house_id) notFound()

  const [{ data: oh }, { data: agent }] = await Promise.all([
    supabase
      .from('open_houses')
      .select('code_word, code_word_email, property_address, street_address, open_house_date, open_house_hours')
      .eq('id', visitor.open_house_id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('full_name, brokerage, primary_color, accent_color')
      .eq('id', visitor.agent_id)
      .maybeSingle(),
  ])
  if (!oh) notFound()

  const smsWord = oh.code_word || ''
  const emailWord = oh.code_word_email || oh.code_word || ''
  const primaryColor = agent?.primary_color || '#1d1d1f'
  const accentColor = agent?.accent_color || '#0071e3'
  const onPrimary = onColor(primaryColor)
  const accentText = readableOnLight(accentColor)
  const primaryIsLight = isLightColor(primaryColor)
  const firstName = (visitor.first_name || '').trim()

  const font = "'Plus Jakarta Sans', sans-serif"
  const wordBox = {
    fontSize: '30px',
    fontWeight: 800 as const,
    letterSpacing: '3px',
    color: '#1d1d1f',
    background: '#f5f5f7',
    border: '1px solid #d1d1d6',
    borderRadius: '14px',
    padding: '16px 12px',
    textAlign: 'center' as const,
    wordBreak: 'break-word' as const,
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: font, paddingBottom: '40px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ background: primaryColor, width: '100%', padding: '22px 20px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', fontWeight: 200, color: onPrimary, letterSpacing: '-0.5px' }}>
          oh<span style={{ fontWeight: 700 }}>ACCESS</span>
        </div>
        <div style={{ fontSize: '11px', color: primaryIsLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
          Verified Open House Check-In
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '420px', padding: '18px 16px 0' }}>
        <div style={{ background: 'white', borderRadius: '18px', border: '1px solid #d1d1d6', padding: '22px 20px' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#1d1d1f', marginBottom: '4px' }}>
            {firstName ? `${firstName}, you're checked in` : "You're checked in"}
          </div>
          <div style={{ fontSize: '14px', color: '#6e6e73', lineHeight: 1.5, marginBottom: '18px' }}>
            <strong style={{ color: '#1d1d1f' }}>{oh.property_address || oh.street_address}</strong>
            {(oh.open_house_date || oh.open_house_hours) && (
              <><br />{[oh.open_house_date, oh.open_house_hours].filter(Boolean).join(' · ')}</>
            )}
            {agent?.full_name && <><br />Hosted by {agent.full_name}{agent.brokerage ? ` · ${agent.brokerage}` : ''}</>}
          </div>

          <div style={{ fontSize: '11px', fontWeight: 600, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
            Your codeword
          </div>
          <div style={wordBox}>{smsWord}</div>

          <div style={{ fontSize: '14px', color: '#1d1d1f', lineHeight: 1.55, marginTop: '14px' }}>
            At the door, share your codeword with the host to be granted access.
          </div>

          {emailWord && emailWord !== smsWord && (
            <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #f2f2f7' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
                Backup codeword (also in your email)
              </div>
              <div style={{ ...wordBox, fontSize: '22px', padding: '12px' }}>{emailWord}</div>
            </div>
          )}

          <div style={{ fontSize: '12px', color: accentText, fontWeight: 600, marginTop: '16px' }}>
            ✓ Agent has been notified of your arrival.
          </div>
        </div>

        <div style={{ marginTop: '16px', fontSize: '12px', color: '#6e6e73', textAlign: 'center' }}>
          <a href="https://ohaccess.com" style={{ color: '#6e6e73', textDecoration: 'none' }}>Powered by ohACCESS</a> · <span style={{ fontWeight: 600 }}>Patent Pending</span>
        </div>
      </div>
    </main>
  )
}
