import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/auth'

function generateCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function getUniqueCode(): Promise<string | null> {
  for (let i = 0; i < 10; i++) {
    const code = generateCode()
    const { data } = await supabase
      .from('short_urls')
      .select('code')
      .eq('code', code)
      .maybeSingle()
    if (!data) return code
  }
  return null
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

// Only allow shortening URLs the authenticated agent actually owns —
// either a URL on their profile or one attached to one of their listings.
// This stops the endpoint from being abused as a free phishing-link laundromat.
async function agentOwnsUrl(agentId: string, url: string, openHouseId: string | null): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('landing_page_url')
    .eq('id', agentId)
    .maybeSingle()
  if (profile?.landing_page_url === url) return true

  if (openHouseId) {
    const { data: oh } = await supabase
      .from('open_houses')
      .select('agent_id, listing_url')
      .eq('id', openHouseId)
      .maybeSingle()
    if (oh && oh.agent_id === agentId && oh.listing_url === url) return true
  }

  return false
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = getClientIp(request)
    const limit = await checkRateLimit(`ip:${ip}`, 'shorten', 60, 3600)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { destinationUrl, openHouseId, urlType } = await request.json()

    if (!isHttpUrl(destinationUrl)) {
      return NextResponse.json({ error: 'A valid http(s) URL is required' }, { status: 400 })
    }

    if (!(await agentOwnsUrl(user.id, destinationUrl, openHouseId ?? null))) {
      return NextResponse.json(
        { error: 'You can only shorten URLs from your own profile or listings' },
        { status: 403 }
      )
    }

    const code = await getUniqueCode()
    if (!code) {
      return NextResponse.json({ error: 'Could not generate a unique code' }, { status: 500 })
    }

    const { data, error } = await supabase
      .from('short_urls')
      .insert({
        code,
        destination_url: destinationUrl,
        agent_id: user.id,
        open_house_id: openHouseId || null,
        url_type: urlType || null
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      code: data.code,
      shortUrl: `https://ohaccess.com/r/${data.code}`
    })
  } catch (error) {
    console.error('Shorten error:', error)
    return NextResponse.json({ error: 'Failed to shorten URL' }, { status: 500 })
  }
}
