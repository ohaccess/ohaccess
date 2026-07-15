import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { stripe, getPriceConfig } from '@/lib/stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ohaccess.com'

// POST: start a PUBLIC gift checkout — deliberately NO auth, because the whole
// point is that the giver (a parent, spouse, colleague) doesn't have an
// ohACCESS account. One product only: 1 year of Pro as a ONE-TIME payment,
// never a subscription, so the giver can't be surprise-billed next year.
//
// The amount is read live from the Pro annual price at Stripe, so gift pricing
// can never drift from the pricing page. metadata.gift='true' routes the
// completed session to the webhook's gift handler, which mints the claim code
// and sends the giver (and optionally the recipient) their emails.

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'gift-checkout', 10, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const giverName = cleanText(body?.giverName, 80)
    const recipientName = cleanText(body?.recipientName, 80)
    const recipientEmail = cleanText(body?.recipientEmail, 200)
    // Stripe metadata values cap at 500 chars — the note rides there.
    const note = cleanText(body?.note, 400)

    if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json(
        { error: "That recipient email doesn't look right — fix it or leave it blank to deliver the gift yourself." },
        { status: 400 }
      )
    }

    const annual = await stripe.prices.retrieve(getPriceConfig('pro', 'year').priceId)
    if (!annual.unit_amount) {
      console.error('Gift checkout: Pro annual price has no unit_amount', annual.id)
      return NextResponse.json({ error: 'Gift checkout is temporarily unavailable' }, { status: 500 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: annual.currency ?? 'usd',
            unit_amount: annual.unit_amount,
            product_data: {
              name: 'ohACCESS Pro — 1-Year Gift',
              description:
                'One year of ohACCESS Pro for a real estate agent. One-time payment — never auto-renews.',
            },
          },
        },
      ],
      success_url: `${APP_URL}/gift?status=success`,
      cancel_url: `${APP_URL}/gift?status=cancel`,
      metadata: {
        gift: 'true',
        giver_name: giverName,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        gift_note: note,
      },
      payment_intent_data: { description: 'ohACCESS Pro 1-year gift' },
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a session URL' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Gift checkout error:', error)
    return NextResponse.json({ error: 'Failed to start gift checkout' }, { status: 500 })
  }
}
