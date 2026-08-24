import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { archiveVisitorById } from '@/lib/visitor-archive'
import { agentTrialLocked } from '@/lib/trial-cap'

// DELETE: remove a single visitor, archiving the record first (visitor_archive,
// migration 026) — the dashboard's "Delete visitor" button must not destroy
// the record of who was inside the house. Replaces the old direct client-side
// supabase delete, which was a true hard delete. Owner-scoped like the RLS
// policy it supersedes.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: visitor } = await supabase
    .from('visitors')
    .select('id, agent_id')
    .eq('id', id)
    .maybeSingle()
  if (!visitor) return NextResponse.json({ error: 'Visitor not found' }, { status: 404 })
  if (visitor.agent_id !== user.id) {
    return NextResponse.json({ error: 'That visitor is not yours' }, { status: 403 })
  }

  // Trial lockout (lib/trial-cap.ts): a free agent past the cap can't delete
  // visitors — removing rows would pull the count back under the cap and
  // re-open registration, letting the trial reset forever. Enforced here,
  // not just in the dashboard's disabled buttons.
  if (await agentTrialLocked(supabase, user.id)) {
    return NextResponse.json(
      { error: 'Your free trial is used up — subscribe to keep managing your visitors.' },
      { status: 403 }
    )
  }

  // Archive BEFORE deleting; if archiving fails, abort — never silently
  // lose the record.
  try {
    await archiveVisitorById(id)
  } catch (err) {
    console.error('Visitor archive failed, aborting visitor delete', err)
    return NextResponse.json({ error: 'Could not delete visitor' }, { status: 500 })
  }

  const { error } = await supabase.from('visitors').delete().eq('id', id)
  if (error) {
    console.error('Visitor delete failed', error)
    return NextResponse.json({ error: 'Could not delete visitor' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
