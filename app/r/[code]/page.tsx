import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function RedirectPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const { data, error } = await supabase
    .from('short_urls')
    .select('destination_url, clicks')
    .eq('code', code)
    .single()

  if (error || !data) {
    redirect('https://ohaccess.com')
  }

  // Increment click counter
  await supabase
    .from('short_urls')
    .update({ clicks: (data.clicks || 0) + 1 })
    .eq('code', code)

  redirect(data.destination_url)
}