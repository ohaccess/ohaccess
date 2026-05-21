import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(request: Request) {
  try {
    const { name, email, phone, brokerage, agentCount, message } = await request.json()

    await resend.emails.send({
      from: 'ohACCESS Contact <noreply@mail.ohaccess.com>',
      to: 'sales@ohaccess.com',
      replyTo: email,
      subject: `🏢 Brokerage inquiry — ${brokerage} (${agentCount} agents)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f5f5f7; padding: 20px;">
          <div style="background: #1d1d1f; border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
            <div style="font-size: 22px; font-weight: 200; color: white;">oh<strong>ACCESS</strong></div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">New Brokerage Inquiry</div>
          </div>
          <div style="background: white; border-radius: 0 0 16px 16px; padding: 24px;">
            <div style="background: #f5f5f7; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
              <div style="font-size: 11px; color: #6e6e73; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Contact Details</div>
              <div style="font-size: 14px; color: #1d1d1f; margin-bottom: 6px;"><strong>Name:</strong> ${name}</div>
              <div style="font-size: 14px; color: #1d1d1f; margin-bottom: 6px;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #0071e3;">${email}</a></div>
              <div style="font-size: 14px; color: #1d1d1f; margin-bottom: 6px;"><strong>Phone:</strong> ${phone || 'Not provided'}</div>
              <div style="font-size: 14px; color: #1d1d1f; margin-bottom: 6px;"><strong>Brokerage:</strong> ${brokerage}</div>
              <div style="font-size: 14px; color: #1d1d1f;"><strong>Agent Count:</strong> ${agentCount}</div>
            </div>
            ${message ? `
            <div style="background: #f5f5f7; border-radius: 10px; padding: 16px;">
              <div style="font-size: 11px; color: #6e6e73; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Message</div>
              <div style="font-size: 14px; color: #1d1d1f; line-height: 1.6;">${message}</div>
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