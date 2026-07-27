import type { MetadataRoute } from 'next'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

const BASE = 'https://www.ohaccess.com'

// Regenerated per request so articles published by the GrandRanker webhook
// appear without a redeploy.
export const dynamic = 'force-dynamic'

// The public, indexable pages. App surfaces and per-link pages (register,
// report, map) are deliberately absent — see robots.ts.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, updated_at')
    .order('published_at', { ascending: false })

  return [
    { url: `${BASE}/`, priority: 1 },
    { url: `${BASE}/resources`, priority: 0.8 },
    { url: `${BASE}/faq`, priority: 0.7 },
    { url: `${BASE}/partners`, priority: 0.8 },
    { url: `${BASE}/gift`, priority: 0.7 },
    { url: `${BASE}/contact`, priority: 0.6 },
    { url: `${BASE}/blog`, priority: 0.7 },
    ...(posts ?? []).map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: p.updated_at,
      priority: 0.6,
    })),
    { url: `${BASE}/terms`, priority: 0.3 },
    { url: `${BASE}/privacy`, priority: 0.3 },
    { url: `${BASE}/subscriber-terms`, priority: 0.3 },
  ]
}
