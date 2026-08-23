import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { Resend } from 'resend'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { escapeHtml } from '@/lib/escape-html'
import { agentCopyRecipients } from '@/lib/register-helpers'
import { sendVisitorCodewordMessages } from '@/lib/codeword-messages'
import {
  normalizeAgreementTemplates,
  resolveAgreementDocs,
  buildDocSnapshots,
  signerNameError,
  normalizeSignerName,
} from '@/lib/agreements'
import { buildSignedAgreementPdf } from '@/lib/agreement-pdf'

export const runtime = 'nodejs'
// Merging PDFs + an email send comfortably fits, but leave headroom over the
// platform default so a slow storage read can't kill a signature mid-ceremony.
export const maxDuration = 60

const resend = new Resend(process.env.RESEND_API_KEY!)

// The signature ceremony (no auth — the visitor isn't logged in; same
// one-time-token trust model as /api/feedback). SEND-AND-FORGET:
//
//   1. Assemble the signed PDF in memory (templates + certificate page).
//   2. Email it to the visitor with the host agent copied — ONE send, so both
//      parties provably received the same bytes.
//   3. Write the one-line receipt (agreement_receipts) with the Resend
//      message id. The PDF itself is never written anywhere.
//
// Order matters: the email goes FIRST. If it fails, no receipt is written and
// the visitor can simply tap Sign again — a receipt without delivered copies
// would be a signature nobody holds. The receipt insert coming second means a
// bookkeeping failure after a successful send is logged loudly but does not
// tell the visitor their (already delivered) signature failed.
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'agreement-sign', 20, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    if (signerNameError(body?.name)) {
      return NextResponse.json({ error: 'Please type your full name' }, { status: 400 })
    }
    const signerName = normalizeSignerName(body.name)

    const { data: visitor } = await supabase
      .from('visitors')
      .select('id, open_house_id, agent_id, email, phone, sms_opted_out, sms_message_sid, sms_status, email_message_id')
      .eq('feedback_token', token)
      .maybeSingle()
    if (!visitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Write-once: one signature ceremony per sign-in. A repeat (double tap,
    // reloaded page) is treated as success, like /api/feedback.
    const { data: existingReceipt } = await supabase
      .from('agreement_receipts')
      .select('id')
      .eq('visitor_id', visitor.id)
      .maybeSingle()
    if (existingReceipt) {
      return NextResponse.json({ success: true, alreadySigned: true })
    }

    const { data: openHouse } = await supabase
      .from('open_houses')
      .select('*, profiles(*)')
      .eq('id', visitor.open_house_id)
      .maybeSingle()
    if (!openHouse) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const agent = openHouse.profiles

    // The codeword SMS + email that /api/register deliberately DID NOT send
    // for this agreement-gated open house — the codeword is door access, so
    // it waits for the signature. Released here via the shared sender
    // (lib/codeword-messages). Pending = never attempted: null sid/status
    // (SMS) and null message id (email), so visitors from before agreement
    // gating (messaged at sign-in) are never sent duplicates. Best-effort: a
    // failed message must never fail the (already delivered) signature.
    const releaseCodewordMessages = async () => {
      const smsPending =
        !!visitor.phone && !visitor.sms_opted_out && !visitor.sms_message_sid && !visitor.sms_status
      const emailPending = !visitor.email_message_id
      if (!smsPending && !emailPending) return
      await sendVisitorCodewordMessages({
        visitorId: visitor.id,
        email: visitor.email,
        phone: visitor.phone,
        phoneOptedOut: !!visitor.sms_opted_out,
        openHouse,
        agent,
        channels: { sms: smsPending, email: emailPending },
      })
    }

    const docs = openHouse.require_agreement
      ? resolveAgreementDocs(
          normalizeAgreementTemplates(agent?.agreement_templates),
          openHouse.agreement_template_ids
        )
      : []
    // Fail open: if the documents vanished between sign-in and signing (the
    // agent deleted them mid-open-house), there is nothing left to sign. The
    // register route still held back the codeword messages, so release them
    // now — otherwise this visitor would never get their codeword.
    if (docs.length === 0) {
      await releaseCodewordMessages()
      return NextResponse.json({ success: true, nothingToSign: true })
    }

    const docBytes: Uint8Array[] = []
    for (const doc of docs) {
      const { data: file, error } = await supabase.storage
        .from('agreement-templates')
        .download(doc.path)
      if (error || !file) {
        console.error('Agreement sign: template download failed:', doc.path, error)
        return NextResponse.json({ error: 'Could not load the documents. Please try again.' }, { status: 500 })
      }
      docBytes.push(new Uint8Array(await file.arrayBuffer()))
    }

    const receiptId = randomUUID()
    const signedAtIso = new Date().toISOString()
    const snapshots = buildDocSnapshots(docs)
    const pdfBytes = await buildSignedAgreementPdf({
      docBytes,
      docs: snapshots,
      signerName,
      visitorEmail: visitor.email || '',
      agentName: agent?.full_name || '',
      agentBrokerage: agent?.brokerage || '',
      agentEmail: agent?.display_email || agent?.email || '',
      propertyAddress: openHouse.property_address || '',
      openHouseDate: openHouse.open_house_date || '',
      signedAtIso,
      timezone: openHouse.timezone || '',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') || '',
      receiptId,
    })

    // One send, visitor as the primary recipient, agent's copy via the same
    // cc/bcc scheme as the codeword email. Everything interpolated is escaped.
    const agentCopy = agentCopyRecipients(agent?.display_email, agent?.email)
    const streetAddress = openHouse.street_address || openHouse.property_address || 'the open house'
    const docList = snapshots
      .map(d => `<li style="padding: 2px 0;">${escapeHtml(d.label)}</li>`)
      .join('')
    const sent = await resend.emails.send({
      from: 'ohACCESS <noreply@mail.ohaccess.com>',
      to: visitor.email,
      cc: agentCopy.cc,
      bcc: agentCopy.bcc,
      replyTo: agent?.display_email || agent?.email || 'support@ohaccess.com',
      subject: `Signed copy — ${streetAddress}`,
      attachments: [
        {
          filename: `Signed-Agreement-${(streetAddress || '').replace(/[^\w\- ]/g, '').trim().replace(/ +/g, '-') || 'ohACCESS'}.pdf`,
          content: Buffer.from(pdfBytes),
        },
      ],
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 20px;">
          <div style="background: #1d1d1f; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
            <div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">Your signed copy is attached</div>
          </div>
          <div style="background: white; border-radius: 0 0 16px 16px; padding: 24px;">
            <div style="font-size: 13px; color: #1d1d1f; line-height: 1.7;">
              <strong>${escapeHtml(signerName)}</strong> signed the following before touring
              <strong>${escapeHtml(openHouse.property_address || '')}</strong>:
            </div>
            <ul style="font-size: 13px; color: #1d1d1f; line-height: 1.7; margin: 10px 0; padding-left: 20px;">${docList}</ul>
            <div style="background: #f5f5f7; border-radius: 10px; padding: 12px 14px; font-size: 12px; color: #6e6e73; line-height: 1.7;">
              The attached PDF is the complete signed record — the document${snapshots.length === 1 ? '' : 's'} plus a signature certificate.
              <strong style="color: #1d1d1f;">Please keep this email: ohACCESS does not store signed documents.</strong>
              This copy went to both the signer and the host agent.
            </div>
          </div>
        </div>
      `,
    })
    if (sent.error) {
      console.error('Agreement sign: email send failed:', sent.error)
      return NextResponse.json({ error: 'Could not send your signed copy. Please try again.' }, { status: 500 })
    }

    // The receipt — the ONLY durable record. Snapshots everything it needs to
    // stand alone after the open house / visitors are deleted (no FKs).
    const { error: receiptErr } = await supabase.from('agreement_receipts').insert({
      id: receiptId,
      visitor_id: visitor.id,
      open_house_id: visitor.open_house_id,
      agent_id: visitor.agent_id,
      signer_name: signerName,
      visitor_email: visitor.email,
      agent_email: agent?.display_email || agent?.email || null,
      property_address: openHouse.property_address || null,
      documents: snapshots,
      signed_at: signedAtIso,
      ip_address: ip,
      user_agent: request.headers.get('user-agent'),
      email_message_id: sent.data?.id ?? null,
    })
    if (receiptErr) {
      // The signed copies ARE delivered at this point; a lost receipt is a
      // bookkeeping emergency, not a visitor-facing failure.
      console.error(
        `[AGREEMENT] receipt insert FAILED for visitor ${visitor.id} (email ${sent.data?.id}): ${receiptErr.message}`
      )
    }

    // Signature delivered — now release the codeword SMS + email the register
    // route held back for this agreement-gated open house.
    await releaseCodewordMessages()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Agreement sign error:', err)
    return NextResponse.json({ error: 'Could not record your signature. Please try again.' }, { status: 500 })
  }
}
