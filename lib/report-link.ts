import 'server-only'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { generateCode } from '@/lib/register-helpers'

// One stable seller-report link per open house, created lazily — the
// getOrCreateShortUrl pattern from the reminder cron, but keyed on
// (open_house_id, url_type) since an agent has many open houses. The row
// rides the open-house delete cascade (short_urls deletes by open_house_id),
// so a report link dies with its open house.
export async function getOrCreateSellerReportCode(
  openHouseId: string,
  agentId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('short_urls')
    .select('code')
    .eq('open_house_id', openHouseId)
    .eq('url_type', 'seller_report')
    .maybeSingle()
  if (existing) return existing.code

  let code: string | null = null
  for (let i = 0; i < 10; i++) {
    const candidate = generateCode()
    const { data } = await supabase
      .from('short_urls')
      .select('code')
      .eq('code', candidate)
      .maybeSingle()
    if (!data) { code = candidate; break }
  }
  if (!code) return null

  const { data: created, error } = await supabase
    .from('short_urls')
    .insert({
      code,
      destination_url: `https://www.ohaccess.com/report/${code}`,
      agent_id: agentId,
      open_house_id: openHouseId,
      url_type: 'seller_report',
    })
    .select('code')
    .single()
  return error || !created ? null : created.code
}
