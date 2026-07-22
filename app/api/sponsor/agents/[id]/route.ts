import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'

// DELETE: end the sponsorship of one agent. Only clears the link if that
// agent is actually sponsored by the caller's sponsor account. (Agents can
// also end it themselves from their Settings tab.)
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
    .from('profiles')
    .update({ sponsor_id: null })
    .eq('id', id)
    .eq('sponsor_id', sponsor.id)
  if (error) {
    console.error('Sponsor unlink failed', error)
    return NextResponse.json({ error: 'Could not remove the agent' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
