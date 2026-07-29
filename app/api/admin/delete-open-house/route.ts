import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser, isAdmin } from '@/lib/auth'
import { checkOpenHouseHold } from '@/lib/legal-hold'

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

  let body: { openHouseId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const openHouseId = body.openHouseId
  if (!openHouseId) {
    return NextResponse.json({ error: 'Missing openHouseId' }, { status: 400 })
  }

  const { data: oh, error: ohError } = await supabase
    .from('open_houses')
    .select('id, property_address, street_address')
    .eq('id', openHouseId)
    .single()

  if (ohError || !oh) {
    return NextResponse.json({ error: 'Open house not found' }, { status: 404 })
  }

  // Preservation hold (migration 041) overrides this purge — including when
  // it is being run to honor a visitor's §6 deletion request. Policy §5
  // reserves exactly that: deletion is "subject to any legal obligations to
  // retain certain records."
  const hold = await checkOpenHouseHold(openHouseId)
  if (hold.held) {
    console.warn(`[DELETE-OPEN-HOUSE] BLOCKED by legal hold: ${openHouseId} — ${hold.summary}`)
    return NextResponse.json(
      {
        error: `Blocked by a legal hold on this open house (${hold.summary}). Nothing was deleted. Release the hold in legal_holds only when counsel confirms the matter is closed.`,
        legalHold: hold.counts,
      },
      { status: 409 }
    )
  }

  const { count: visitorCount } = await supabase
    .from('visitors')
    .select('id', { count: 'exact', head: true })
    .eq('open_house_id', openHouseId)

  try {
    // Children first, then the open house itself. DELIBERATELY no
    // visitor_archive copy here (unlike the agent-facing delete): the admin
    // path is the true hard-delete for test-data cleanup and for honoring a
    // visitor's data-deletion request.
    await del('visitors', supabase.from('visitors').delete().eq('open_house_id', openHouseId))
    await del('short_urls', supabase.from('short_urls').delete().eq('open_house_id', openHouseId))
    // Agreement receipts carry the visitor's name/email (migration 043), so a
    // true hard-delete must clear them too. Held receipts were already caught
    // by the checkOpenHouseHold gate above.
    await del('agreement_receipts', supabase.from('agreement_receipts').delete().eq('open_house_id', openHouseId))
    await del('open_house', supabase.from('open_houses').delete().eq('id', openHouseId))
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error(`[DELETE-OPEN-HOUSE] FAILED by ${admin.email} on ${openHouseId}: ${message}`)
    return NextResponse.json(
      { error: `Deletion failed at step "${message}". Please retry.` },
      { status: 500 }
    )
  }

  const address = oh.street_address || oh.property_address || 'Untitled listing'
  console.log(
    `[DELETE-OPEN-HOUSE] ${admin.email} deleted open house ${openHouseId} ("${address}") — ` +
      `${visitorCount || 0} visitors, at ${new Date().toISOString()}`
  )

  return NextResponse.json({
    deleted: { id: openHouseId, address, visitors: visitorCount || 0 },
  })
}
