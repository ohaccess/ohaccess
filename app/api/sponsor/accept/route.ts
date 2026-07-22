import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'

async function lookupInvite(token: string) {
  const { data } = await supabase
    .from('sponsor_invitations')
    .select('id, sponsor_id, email, expires_at, accepted_at, sponsors(full_name, company)')
    .eq('token', token)
    .maybeSingle()
  return data
}

function sponsorLabel(sponsor: { full_name: string | null; company: string | null } | null): string {
  if (!sponsor?.full_name) return 'A sponsor'
  return sponsor.company ? `${sponsor.full_name} (${sponsor.company})` : sponsor.full_name
}

// GET: public lookup so the sponsor-invite page can show who's inviting and
// pre-fill / lock the email. Does not require auth.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!token) return NextResponse.json({ valid: false, reason: 'missing' }, { status: 400 })

  const invite = await lookupInvite(token)
  if (!invite) return NextResponse.json({ valid: false, reason: 'not_found' })
  if (invite.accepted_at) return NextResponse.json({ valid: false, reason: 'used' })
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' })
  }

  const sponsor = invite.sponsors as unknown as { full_name: string | null; company: string | null } | null
  return NextResponse.json({
    valid: true,
    email: invite.email,
    sponsorName: sponsorLabel(sponsor),
  })
}

// POST: finalize acceptance. Requires the user to be authenticated AND for
// their email to match the invited email (prevents invite hijacking). This
// click is the agent's on-record approval of the sponsorship.
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Please sign in to accept this invite' }, { status: 401 })

  const { token } = await request.json()
  if (typeof token !== 'string' || !token) {
    return NextResponse.json({ error: 'Missing invite token' }, { status: 400 })
  }

  const invite = await lookupInvite(token)
  if (!invite) return NextResponse.json({ error: 'This invitation is invalid' }, { status: 404 })
  if (invite.accepted_at) {
    return NextResponse.json({ error: 'This invitation has already been used' }, { status: 409 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 })
  }

  const userEmail = (user.email ?? '').toLowerCase()
  if (userEmail !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { error: `This invite is for ${invite.email}. Sign in with that email to accept.` },
      { status: 403 }
    )
  }

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ sponsor_id: invite.sponsor_id })
    .eq('id', user.id)
  if (profileErr) {
    console.error('Sponsor accept: profile update failed', profileErr)
    return NextResponse.json({ error: 'Could not accept the sponsorship' }, { status: 500 })
  }

  await supabase
    .from('sponsor_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  return NextResponse.json({ success: true })
}
