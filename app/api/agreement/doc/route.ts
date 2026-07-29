import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { normalizeAgreementTemplates, resolveAgreementDocs } from '@/lib/agreements'

export const runtime = 'nodejs'

// Serves ONE blank agreement document to the visitor who is about to sign it
// (no auth — the visitor isn't logged in). The bucket is private; access is
// gated on the same one-time token /api/register handed this browser
// (feedback_token), scoped to that visitor's open house and only to the
// documents that open house actually requires. Same trust model as
// /api/feedback: unguessable token, single visitor row.
//
// GET /api/agreement/doc?token=<feedbackToken>&doc=<templateId>
export async function GET(request: Request) {
  try {
    const ip = getClientIp(request)
    // Generous — a visitor re-opening 3 documents a few times is normal; a
    // token brute-force is not.
    const limit = await checkRateLimit(`ip:${ip}`, 'agreement-doc', 60, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const url = new URL(request.url)
    const token = (url.searchParams.get('token') || '').trim()
    const docId = (url.searchParams.get('doc') || '').trim()
    if (!token || !docId) {
      return NextResponse.json({ error: 'Missing token or doc' }, { status: 400 })
    }

    const { data: visitor } = await supabase
      .from('visitors')
      .select('id, open_house_id, agent_id')
      .eq('feedback_token', token)
      .maybeSingle()
    if (!visitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: openHouse } = await supabase
      .from('open_houses')
      .select('require_agreement, agreement_template_ids')
      .eq('id', visitor.open_house_id)
      .maybeSingle()
    const { data: agent } = await supabase
      .from('profiles')
      .select('agreement_templates')
      .eq('id', visitor.agent_id)
      .maybeSingle()

    const docs = openHouse?.require_agreement
      ? resolveAgreementDocs(
          normalizeAgreementTemplates(agent?.agreement_templates),
          openHouse.agreement_template_ids
        )
      : []
    const doc = docs.find(d => d.id === docId)
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: file, error } = await supabase.storage
      .from('agreement-templates')
      .download(doc.path)
    if (error || !file) {
      console.error('Agreement doc download failed:', error)
      return NextResponse.json({ error: 'Document unavailable' }, { status: 404 })
    }

    // Inline so phones open their native PDF viewer in the new tab. The
    // filename is ASCII-sanitized: it rides in a raw header.
    const filename = `${doc.label.replace(/[^\w\- ]/g, '').trim() || 'document'}.pdf`
    return new NextResponse(await file.arrayBuffer(), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('Agreement doc error:', err)
    return NextResponse.json({ error: 'Document unavailable' }, { status: 500 })
  }
}
