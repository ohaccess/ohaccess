import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'
import { archiveVisitorsForAgent } from '@/lib/visitor-archive'

// Helper: run a delete and throw a labeled error so the caller knows which
// step failed (deletions are not transactional across PostgREST calls).
async function del(step: string, run: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await run
  if (error) throw new Error(`${step}: ${error.message}`)
}

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

  // Count what we're about to remove (for the summary returned to the admin).
  const counts = async (table: string, column: string) => {
    const { count } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(column, userId)
    return count || 0
  }
  const visitorCount = await counts('visitors', 'agent_id')
  const openHouseCount = await counts('open_houses', 'agent_id')
  const shortUrlCount = await counts('short_urls', 'agent_id')

  // Brokerages this account owns (owner_id is ON DELETE RESTRICT, so these
  // must go before the auth user can be removed). Deleting a brokerage
  // cascades its invitations and detaches its member agents (brokerage_id
  // is ON DELETE SET NULL on profiles).
  const { data: ownedBrokerages } = await supabase
    .from('brokerages')
    .select('id')
    .eq('owner_id', userId)
  const ownedIds = (ownedBrokerages || []).map((b) => b.id)
  let membersDetached = 0
  if (ownedIds.length) {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('brokerage_id', ownedIds)
      .neq('id', userId)
    membersDetached = count || 0
  }

  // Archive the agent's live visitor log BEFORE anything is deleted, exactly
  // like the agent-facing deletes do. Privacy Policy v1.3 §5 retention is a
  // flat 3 years from collection with NO account-deletion trigger, so closing
  // an account must not destroy the record of who was inside a house. If
  // archiving fails, abort before deleting anything — never silently lose it.
  let visitorsArchived = 0
  try {
    visitorsArchived = await archiveVisitorsForAgent(userId)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error(`[DELETE-ACCOUNT] archive FAILED by ${admin.email} on ${profile.email}: ${message}`)
    return NextResponse.json(
      { error: `Could not archive visitor records (${message}). Nothing was deleted.` },
      { status: 500 }
    )
  }

  try {
    // Children first, then parents. Existing visitor_archive rows are
    // deliberately KEPT (Dave, 2026-07-20) for the same reason as above —
    // they survive until the monthly retention purge
    // (/api/cron/data-retention) ages them out at the 3-year mark.
    await del('visitors', supabase.from('visitors').delete().eq('agent_id', userId))
    await del('short_urls', supabase.from('short_urls').delete().eq('agent_id', userId))
    await del('open_houses', supabase.from('open_houses').delete().eq('agent_id', userId))
    if (ownedIds.length) {
      await del('brokerages', supabase.from('brokerages').delete().eq('owner_id', userId))
    }
    await del('profile', supabase.from('profiles').delete().eq('id', userId))

    // Finally remove the auth login itself.
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)
    if (authError) throw new Error(`auth user: ${authError.message}`)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error(`[DELETE-ACCOUNT] FAILED by ${admin.email} on ${profile.email}: ${message}`)
    return NextResponse.json(
      {
        error: `Deletion partially failed at step "${message}". Some data may have been removed. Please retry.`,
      },
      { status: 500 }
    )
  }

  console.log(
    `[DELETE-ACCOUNT] ${admin.email} deleted ${profile.email} (${profile.id}) — ` +
      `${visitorCount} visitors (${visitorsArchived} archived), ${openHouseCount} open houses, ${shortUrlCount} short URLs, ` +
      `${ownedIds.length} brokerages, ${membersDetached} members detached, at ${new Date().toISOString()}`
  )

  return NextResponse.json({
    deleted: {
      email: profile.email,
      name: profile.full_name || profile.email,
      visitors: visitorCount,
      visitorsArchived,
      openHouses: openHouseCount,
      shortUrls: shortUrlCount,
      brokeragesDeleted: ownedIds.length,
      membersDetached,
    },
  })
}
