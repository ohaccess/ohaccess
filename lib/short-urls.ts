import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { generateCode } from '@/lib/register-helpers'

// Creates a tracked ohaccess.com/r/<code> short link. Shared by the register
// route (codeword SMS + email links) and the agreement-sign route (which sends
// the delayed codeword SMS for agreement-gated open houses). Best-effort:
// returns null on failure so callers just omit the link.
export async function createShortUrl(
  destinationUrl: string,
  agentId: string,
  openHouseId: string,
  urlType: string
): Promise<string | null> {
  let code = generateCode()
  let attempts = 0
  while (attempts < 10) {
    const { data } = await supabase.from('short_urls').select('code').eq('code', code).maybeSingle()
    if (!data) break
    code = generateCode()
    attempts++
  }
  const { error } = await supabase.from('short_urls').insert({
    code,
    destination_url: destinationUrl,
    agent_id: agentId,
    open_house_id: openHouseId,
    url_type: urlType
  })
  if (error) {
    console.error('Short URL creation error:', error)
    return null
  }
  return `https://ohaccess.com/r/${code}`
}
