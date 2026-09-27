import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'
import { deleteAgentAccount, AccountLegalHoldError, AccountArchiveError } from '@/lib/delete-account'

// Admin-only hard delete of an agent account. The teardown itself lives in
// lib/delete-account.ts (shared with the agent's own Close-account button
// and the scheduled-closure cron); this route is the admin guards around it.
export async function POST(request: Request) {
  const admin = await getAuthenticatedUser(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin(admin.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { userId?: string; confirmEmail?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const userId = body.userId
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  if (userId === admin.id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  if (isAdmin(profile.email)) {
    return NextResponse.json(
      { error: 'Cannot delete an admin account.' },
      { status: 403 }
    )
  }

  // Require the caller to confirm the exact email as a guard against mistakes.
  if (
    !body.confirmEmail ||
    body.confirmEmail.trim().toLowerCase() !== (profile.email || '').toLowerCase()
  ) {
    return NextResponse.json(
      { error: 'Confirmation email does not match this account.' },
      { status: 400 }
    )
  }

  try {
    const deleted = await deleteAgentAccount(userId, profile, `admin ${admin.email}`)
    return NextResponse.json({ deleted })
  } catch (e) {
    if (e instanceof AccountLegalHoldError) {
      return NextResponse.json(
        {
          error: `Blocked by a legal hold on this agent's data (${e.summary}). Nothing was deleted. Release the hold in legal_holds only when counsel confirms the matter is closed.`,
          legalHold: e.counts,
        },
        { status: 409 }
      )
    }
    if (e instanceof AccountArchiveError) {
      return NextResponse.json(
        { error: `Could not archive visitor records (${e.message}). Nothing was deleted.` },
        { status: 500 }
      )
    }
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json(
      {
        error: `Deletion partially failed at step "${message}". Some data may have been removed. Please retry.`,
      },
      { status: 500 }
    )
  }
}
