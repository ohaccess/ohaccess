import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'

export async function POST(request: Request) {
  const admin = await getAuthenticatedUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin(admin.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const userId = body.userId
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  // Look up the target agent's email
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', userId)
    .single()

  if (profileError || !profile?.email) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  // Never allow impersonating another admin account.
  if (isAdmin(profile.email)) {
    return NextResponse.json(
      { error: 'Cannot impersonate another admin account.' },
      { status: 403 }
    )
  }

  // Generate a one-time login token for the target user. generateLink does
  // NOT send an email — it just returns the token, which the admin's browser
  // verifies to establish a session as the target user.
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
  })

  const tokenHash = data?.properties?.hashed_token
  if (error || !tokenHash) {
    return NextResponse.json(
      { error: error?.message || 'Could not generate sign-in token' },
      { status: 500 }
    )
  }

  // Audit trail (visible in Vercel logs).
  console.log(
    `[IMPERSONATE] ${admin.email} -> ${profile.email} (${profile.id}) at ${new Date().toISOString()}`
  )

  return NextResponse.json({
    token_hash: tokenHash,
    email: profile.email,
    name: profile.full_name || profile.email,
  })
}
