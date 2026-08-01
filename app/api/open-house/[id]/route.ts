import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { getClientIp } from '@/lib/rate-limit'
import { archiveVisitorsForOpenHouse } from '@/lib/visitor-archive'
import { getOpenHouseDisplay } from '@/lib/open-house-display'

// GET: public, read-only display data for the visitor registration page.
// The register page now server-renders this data itself (same shared
// function in lib/open-house-display.ts — see there for the field-safety
// rules and the qr_scans logging); this route stays for anything else that
// needs the safe display shape over HTTP. This is what replaced the old anon
// `select('*, profiles(*)')` that leaked the access codes and full agent
// profile to anyone.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const data = await getOpenHouseDisplay(id, {
    ip: getClientIp(request),
    userAgent: request.headers.get('user-agent'),
  })

  if (!data) {
    return NextResponse.json({ error: 'Open house not found' }, { status: 404 })
  }

  return NextResponse.json(data)
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

  // Archive the visitor log BEFORE deleting it (visitor_archive, migration
  // 026): a dashboard cleanup must not destroy the record of who was inside
  // the house. Retained up to 3 years from collection per Privacy Policy §5,
  // including through account deletion (delete-account archives too, as of
  // 2026-07-27). If archiving fails, abort the delete — never
  // silently lose the log.
  try {
    await archiveVisitorsForOpenHouse(id)
  } catch (err) {
    console.error('Visitor archive failed, aborting open-house delete', err)
    return NextResponse.json({ error: 'Could not delete open house' }, { status: 500 })
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
