import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: public, read-only display data for the visitor registration page.
// Returns ONLY safe fields — never the secret code_word/code_word_email, and
// only the agent's public-facing branding (name + colors). Runs with the
// service role so it works once RLS locks the open_houses/profiles tables to
// their owners. This is what replaced the old anon `select('*, profiles(*)')`
// that leaked the access codes and full agent profile to anyone.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: oh, error } = await supabase
    .from('open_houses')
    .select('id, property_address, listing_price, bedrooms, bathrooms, square_footage, open_house_date, open_house_hours, status, agent_id')
    .eq('id', id)
    .maybeSingle()

  if (error || !oh) {
    return NextResponse.json({ error: 'Open house not found' }, { status: 404 })
  }

  const { data: agent } = await supabase
    .from('profiles')
    .select('full_name, primary_color, accent_color')
    .eq('id', oh.agent_id)
    .maybeSingle()

  // Shape matches what the page expects: open-house fields with a nested
  // `profiles` object for the agent's branding. agent_id is intentionally
  // omitted from the response.
  return NextResponse.json({
    id: oh.id,
    property_address: oh.property_address,
    listing_price: oh.listing_price,
    bedrooms: oh.bedrooms,
    bathrooms: oh.bathrooms,
    square_footage: oh.square_footage,
    open_house_date: oh.open_house_date,
    open_house_hours: oh.open_house_hours,
    status: oh.status,
    profiles: {
      full_name: agent?.full_name ?? null,
      primary_color: agent?.primary_color ?? null,
      accent_color: agent?.accent_color ?? null,
    },
  })
}

// DELETE: remove an open house and ALL its child rows. Done server-side with
// the service role because the children have foreign keys back to open_houses
// (short_urls especially) and short_urls is locked to the service role by RLS —
// a client-side delete can't clear them, which previously made deletes fail
// silently with a FK violation. Verifies the caller owns the open house first.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: oh } = await supabase
    .from('open_houses')
    .select('id, agent_id')
    .eq('id', id)
    .maybeSingle()
  if (!oh) return NextResponse.json({ error: 'Open house not found' }, { status: 404 })
  if (oh.agent_id !== user.id) {
    return NextResponse.json({ error: 'That open house is not yours' }, { status: 403 })
  }

  // Delete children first (FK order), then the open house itself.
  await supabase.from('short_urls').delete().eq('open_house_id', id)
  await supabase.from('visitors').delete().eq('open_house_id', id)
  const { error } = await supabase.from('open_houses').delete().eq('id', id)
  if (error) {
    console.error('Open house delete failed', error)
    return NextResponse.json({ error: 'Could not delete open house' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
