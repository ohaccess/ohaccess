import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { usPhoneError } from '@/lib/phone'
import { isEmail } from '@/lib/register-helpers'
import { escapeHtml } from '@/lib/escape-html'
import { resolveExpiredAgent, buildExpiredLeadEmail } from '@/lib/expired-lead'

const resend = new Resend(process.env.RESEND_API_KEY!)

// Lead capture from an expired open-house link (see lib/expired-lead.ts).
// The agent's standing is re-checked HERE, never trusted from the client: a
// good-standing agent gets the lead emailed to them (replyTo = the buyer);
// anything else — lapsed agent, unknown link, deleted account — routes the
// lead to ohACCESS instead, so a submission is never dropped.
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'expired-lead', 5, 3600)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      )
    }

    const { openHouseId, name, email, phone, zip } = await request.json()

    if (
      typeof openHouseId !== 'string' ||
      typeof name !== 'string' || !name.trim() ||
      !isEmail(email) ||
      typeof zip !== 'string' || !zip.trim()
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const phoneErr = usPhoneError(phone)
    if (phoneErr) {
      return NextResponse.json({ error: phoneErr }, { status: 400 })
    }

    const lead = {
      name: name.trim().slice(0, 200),
      email: email.trim().slice(0, 200),
      phone: String(phone).trim().slice(0, 40),
      zip: zip.trim().slice(0, 12),
    }

    const agent = await resolveExpiredAgent(openHouseId)

    if (agent) {
      const { subject, html } = buildExpiredLeadEmail(agent, lead)
      await resend.emails.send({
        from: 'ohACCESS <noreply@mail.ohaccess.com>',
        to: agent.email,
        replyTo: lead.email,
        subject,
        html,
      })
    } else {
      // Lapsed/unknown agent — the lead belongs to ohACCESS (the same
      // destination the expired page used before agent routing existed).
      await resend.emails.send({
        from: 'ohACCESS <noreply@mail.ohaccess.com>',
        to: 'sales@ohaccess.com',
        replyTo: lead.email,
        subject: '🏠 Buyer lead from expired QR code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <p>Buyer lead from an expired open-house link (agent lapsed or unknown).</p>
            <p><strong>Name:</strong> ${escapeHtml(lead.name)}<br/>
            <strong>Email:</strong> ${escapeHtml(lead.email)}<br/>
            <strong>Phone:</strong> ${escapeHtml(lead.phone)}<br/>
            <strong>Zip:</strong> ${escapeHtml(lead.zip)}<br/>
            <strong>Open house id:</strong> ${escapeHtml(openHouseId)}</p>
          </div>`,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('expired-lead error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
