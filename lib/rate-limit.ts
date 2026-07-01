import { supabaseAdmin as supabase } from './supabase-admin'

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString()

  const { count } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('identifier', identifier)
    .eq('endpoint', endpoint)
    .gte('created_at', windowStart)

  const used = count ?? 0
  if (used >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfterSeconds: windowSeconds }
  }

  await supabase.from('rate_limits').insert({ identifier, endpoint })

  if (Math.random() < 0.01) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('rate_limits').delete().lt('created_at', cutoff)
  }

  return { allowed: true, remaining: maxRequests - used - 1, retryAfterSeconds: 0 }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}
