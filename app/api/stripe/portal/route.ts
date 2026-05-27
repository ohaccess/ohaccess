import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ohaccess.com'

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'stripe-portal', 30, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer on file. Start a subscription first.' },
        { status: 400 }
      )
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${APP_URL}/dashboard?view=settings`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe portal error:', error)
    const message = error instanceof Error ? error.message : 'Failed to open billing portal'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
