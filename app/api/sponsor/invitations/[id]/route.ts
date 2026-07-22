import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'

// DELETE: revoke a pending invitation. The invite must belong to the
// caller's own sponsor account.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!sponsor) return NextResponse.json({ error: 'No sponsor profile found' }, { status: 404 })

  const { id } = await params

  const { error } = await supabase
    .from('sponsor_invitations')
    .delete()
    .eq('id', id)
    .eq('sponsor_id', sponsor.id)
  if (error) {
    console.error('Sponsor invite revoke failed', error)
    return NextResponse.json({ error: 'Could not revoke invite' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
