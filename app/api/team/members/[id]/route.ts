import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { getBrokerageContext } from '@/lib/team'
import { sendRemovalEmail } from '@/lib/removal-email'

// DELETE: remove a member from the team. Admin only. The member keeps their
// account and data but drops to the free tier and is unlinked from the team;
// they get an email saying so (Privacy Policy §3A) with where their free
// trial now stands. The owner cannot be removed (they must cancel the
// subscription instead).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getBrokerageContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No team found' }, { status: 404 })
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'Only the team lead can remove members' }, { status: 403 })
  }

  const { id } = await params

  if (id === ctx.ownerId) {
    return NextResponse.json(
      { error: 'The team lead cannot be removed. Cancel the subscription to close the team.' },
      { status: 400 }
    )
  }

  // Only touch a profile that actually belongs to this brokerage.
  const { data: member } = await supabase
    .from('profiles')
    .select('id, brokerage_id')
    .eq('id', id)
    .maybeSingle()
  if (!member || member.brokerage_id !== ctx.brokerageId) {
    return NextResponse.json({ error: 'That person is not on your team' }, { status: 404 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ brokerage_id: null, role: 'agent', tier: 'free' })
    .eq('id', id)
  if (error) {
    console.error('Member removal failed', error)
    return NextResponse.json({ error: 'Could not remove member' }, { status: 500 })
  }

  await sendRemovalEmail(id, 'team', ctx.name)

  return NextResponse.json({ success: true })
}
