import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { escapeHtml } from '@/lib/escape-html'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'contact', 3, 3600)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many messages. Please try again later.' },
        { status: 429 }
      )
    }

    const { name, email, phone, brokerage, agentCount, message, businessType } = await request.json()

    if (!name || !email || !brokerage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // A businessType marks this as a partner (lender/title/inspector/etc.)
    // inquiry rather than a brokerage inquiry, so it's labeled distinctly.
    const isPartner = !!businessType

    const safeName = escapeHtml(name)
    const safeEmail = escapeHtml(email)
    const safePhone = escapeHtml(phone || 'Not provided')
    const safeBrokerage = escapeHtml(brokerage)
    const safeAgentCount = escapeHtml(agentCount)
    const safeBusinessType = escapeHtml(businessType || '')
    const safeMessage = escapeHtml(message)

    await resend.emails.send({
      from: 'ohACCESS Contact <noreply@mail.ohaccess.com>',
      to: 'sales@ohaccess.com',
      replyTo: email,
      subject: isPartner
        ? `🤝 Partner inquiry — ${brokerage}${businessType ? ` (${businessType})` : ''}`
        : `🏢 Brokerage inquiry — ${brokerage} (${agentCount} agents)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 20px;">
          <div style="background: #1d1d1f; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
            <div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">${isPartner ? 'New Partner Inquiry' : 'New Brokerage Inquiry'}</div>
          </div>
          <div style="background: white; border-radius: 0 0 16px 16px; padding: 24px;">
            <div style="background: #f5f5f7; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
              <div style="font-size: 11px; color: #6e6e73; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Contact Details</div>
              <div style="font-size: 14px; color: #1d1d1f; margin-bottom: 6px;"><strong>Name:</strong> ${safeName}</div>
              <div style="font-size: 14px; color: #1d1d1f; margin-bottom: 6px;"><strong>Email:</strong> <a href="mailto:${safeEmail}" style="color: #0071e3;">${safeEmail}</a></div>
              <div style="font-size: 14px; color: #1d1d1f; margin-bottom: 6px;"><strong>Phone:</strong> ${safePhone}</div>
              <div style="font-size: 14px; color: #1d1d1f; margin-bottom: 6px;"><strong>${isPartner ? 'Company' : 'Brokerage'}:</strong> ${safeBrokerage}</div>
              ${isPartner ? `<div style="font-size: 14px; color: #1d1d1f; margin-bottom: 6px;"><strong>Business Type:</strong> ${safeBusinessType}</div>` : ''}
              <div style="font-size: 14px; color: #1d1d1f;"><strong>${isPartner ? 'Agent Partners' : 'Agent Count'}:</strong> ${safeAgentCount}</div>
            </div>
            ${message ? `
            <div style="background: #f5f5f7; border-radius: 10px; padding: 16px;">
              <div style="font-size: 11px; color: #6e6e73; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Message</div>
              <div style="font-size: 14px; color: #1d1d1f; line-height: 1.6;">${safeMessage}</div>
            </div>
            ` : ''}
          </div>
        </div>
      `
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
