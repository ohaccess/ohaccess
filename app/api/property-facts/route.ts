import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getAuthenticatedUser } from '@/lib/auth'
import { factsFrom, pickActiveListing } from '@/lib/property-facts'

// Price, beds, baths and size for a US address, used to pre-fill the New
// Open House form after the agent picks an address. An active listing fills
// everything (1 RentCast lookup); with no active listing we fall back to the
// public record for beds/baths/size and leave price blank (2 lookups).
// Any failure or missing RENTCAST_API_KEY → { facts: null } and the agent
// just types the details, as before.
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.RENTCAST_API_KEY
  if (!apiKey) return NextResponse.json({ facts: null })

  // Each call costs real lookups, so cap it per agent.
  const limit = await checkRateLimit(`user:${user.id}`, 'property-facts', 60, 3600)
  if (!limit.allowed) return NextResponse.json({ facts: null })

  const { searchParams } = new URL(request.url)
  const street = searchParams.get('street')?.trim()
  const city = searchParams.get('city')?.trim()
  const state = searchParams.get('state')?.trim()
  const zip = searchParams.get('zip')?.trim()
  if (!street || !city || !state) {
    return NextResponse.json({ error: 'Missing street, city or state' }, { status: 400 })
  }
  const address = `${street}, ${city}, ${state}${zip ? ' ' + zip : ''}`

  // RentCast answers 404 when it has nothing for the address.
  const lookup = async (path: string): Promise<unknown> => {
    const res = await fetch(`https://api.rentcast.io/v1/${path}?address=${encodeURIComponent(address)}`, {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    return res.ok ? res.json() : null
  }

  try {
    const listing = pickActiveListing(await lookup('listings/sale'))
    if (listing) return NextResponse.json({ facts: factsFrom(listing, true) })

    const records = await lookup('properties')
    const record = Array.isArray(records) ? records[0] : null
    return NextResponse.json({ facts: record ? factsFrom(record, false) : null })
  } catch {
    return NextResponse.json({ facts: null })
  }
}
