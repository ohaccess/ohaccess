import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function generateCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function getUniqueCode(): Promise<string> {
  let code = generateCode()
  let attempts = 0
  while (attempts < 10) {
    const { data } = await supabase
      .from('short_urls')
      .select('code')
      .eq('code', code)
      .single()
    if (!data) return code
    code = generateCode()
    attempts++
  }
  return code
}

export async function POST(request: Request) {
  try {
    const { destinationUrl, agentId, openHouseId, urlType } = await request.json()

    if (!destinationUrl) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const code = await getUniqueCode()

    const { data, error } = await supabase
      .from('short_urls')
      .insert({
        code,
        destination_url: destinationUrl,
        agent_id: agentId || null,
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