import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { getBrokerageContext } from '@/lib/team'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'brokerage-logos'
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/svg+xml', 'svg'],
])

// POST: upload a logo for the admin's brokerage. Server-side upload via
// service role; only the brokerage_admin can do this.
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getBrokerageContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No team found' }, { status: 404 })
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'Only the team lead can change the logo' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Logo must be under 2 MB' }, { status: 400 })
  }
  const ext = ALLOWED.get(file.type)
  if (!ext) {
    return NextResponse.json({ error: 'Logo must be a PNG, JPEG, WebP, or SVG image' }, { status: 400 })
  }

  // Stable path per brokerage; overwrite on re-upload. Cache-bust via ?v=.
  const path = `${ctx.brokerageId}/logo.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadErr) {
    console.error('Logo upload failed', uploadErr)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Remove stale logos in other formats so we don't leave orphans behind.
  const stalePaths = [...ALLOWED.values()]
    .filter((e) => e !== ext)
    .map((e) => `${ctx.brokerageId}/logo.${e}`)
  await supabase.storage.from(BUCKET).remove(stalePaths)

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const logoUrl = `${pub.publicUrl}?v=${Date.now()}`

  const { error: saveErr } = await supabase
    .from('brokerages')
    .update({ logo_url: logoUrl })
    .eq('id', ctx.brokerageId)
  if (saveErr) {
    console.error('Saving logo_url failed', saveErr)
    return NextResponse.json({ error: 'Upload saved but could not update team' }, { status: 500 })
  }

  // Mirror onto member profiles so visitor emails / pages show the team logo.
  await supabase.from('profiles').update({ logo_url: logoUrl }).eq('brokerage_id', ctx.brokerageId)

  return NextResponse.json({ logo_url: logoUrl })
}

// DELETE: remove the brokerage logo. Admin only.
export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getBrokerageContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'No team found' }, { status: 404 })
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'Only the team lead can remove the logo' }, { status: 403 })
  }

  const paths = [...ALLOWED.values()].map((e) => `${ctx.brokerageId}/logo.${e}`)
  await supabase.storage.from(BUCKET).remove(paths)
  await supabase.from('brokerages').update({ logo_url: null }).eq('id', ctx.brokerageId)
  await supabase.from('profiles').update({ logo_url: null }).eq('brokerage_id', ctx.brokerageId)

  return NextResponse.json({ success: true })
}
