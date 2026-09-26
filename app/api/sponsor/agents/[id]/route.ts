import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { sendRemovalEmail } from '@/lib/removal-email'

// DELETE: end the sponsorship of one agent. Only clears the link if that
// agent is actually sponsored by the caller's sponsor account, and emails
// the agent where their account now stands (Privacy Policy §3A). (Agents can
// also end it themselves from their Settings tab; no email for that.)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('id, company, full_name')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!sponsor) return NextResponse.json({ error: 'No sponsor profile found' }, { status: 404 })

  const { id } = await params

  // Only email if a link was actually cleared: `select` returns the touched
  // row, and an unrelated agent id (or one already unlinked) touches nothing.
  const { data: unlinked, error } = await supabase
    .from('profiles')
    .update({ sponsor_id: null })
    .eq('id', id)
    .eq('sponsor_id', sponsor.id)
    .select('id')
  if (error) {
    console.error('Sponsor unlink failed', error)
    return NextResponse.json({ error: 'Could not remove the agent' }, { status: 500 })
  }

  if (unlinked?.length) {
    await sendRemovalEmail(id, 'sponsor', sponsor.company || sponsor.full_name || '')
  }

  return NextResponse.json({ success: true })
}
