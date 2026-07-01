import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { getBrokerageContext } from '@/lib/team'

// DELETE: revoke a pending invitation. Admin only, and the invite must
// belong to the admin's own brokerage.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getBrokerageContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No team found' }, { status: 404 })
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'Only the team lead can revoke invites' }, { status: 403 })
  }

  const { id } = await params

  const { error } = await supabase
    .from('brokerage_invitations')
    .delete()
    .eq('id', id)
    .eq('brokerage_id', ctx.brokerageId)
  if (error) {
    console.error('Invite revoke failed', error)
    return NextResponse.json({ error: 'Could not revoke invite' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
