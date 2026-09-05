import { generateCode } from './register-helpers'

// One stable referral short-code per agent, created lazily on first request.
// Shared by /api/referral-link (the Settings panel) and /api/cron/drip (the
// referral email), so both always hand out the same /r/<code> link. The
// destination's ?ref=<code> is what RefCapture stamps onto signups, making
// the code double as the referral_source value in /admin/sources.

// The short domain is the apex on purpose — it's what prints nicely and what
// /r/<code> redirects from — independent of NEXT_PUBLIC_APP_URL's www host.
export const REFERRAL_LINK_BASE = 'https://ohaccess.com'

type SupabaseLike = { from: (table: string) => any }

export function referralShortUrl(code: string): string {
  return `${REFERRAL_LINK_BASE}/r/${code}`
}

export async function getOrCreateReferralCode(
  supabase: SupabaseLike,
  agentId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('short_urls')
    .select('code')
    .eq('agent_id', agentId)
    .eq('url_type', 'referral')
    .maybeSingle()
  if (existing) return existing.code

  // Insert inside the retry loop so a same-millisecond collision on the code
  // column just moves on to the next candidate instead of failing the call.
  for (let i = 0; i < 10; i++) {
    const candidate = generateCode()
    const { data: taken } = await supabase
      .from('short_urls')
      .select('code')
      .eq('code', candidate)
      .maybeSingle()
    if (taken) continue
    const { data: created, error } = await supabase
      .from('short_urls')
      .insert({
        code: candidate,
        destination_url: `${REFERRAL_LINK_BASE}/?ref=${candidate}`,
        agent_id: agentId,
        url_type: 'referral',
      })
      .select('code')
      .single()
    if (!error && created) return created.code
  }
  return null
}
