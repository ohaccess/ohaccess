import type { MetadataRoute } from 'next'

// Crawl the marketing/legal pages; keep app surfaces, auth flows, and
// private-by-link pages (map/report/register are coded or noindexed) out of
// the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/dashboard',
          '/api/',
          '/auth/',
          '/login',
          '/visitor/',
          '/accept-invite',
          '/gift/claim',
          '/map/',
          '/report/',
          '/register/',
          '/r/',
        ],
      },
    ],
    sitemap: 'https://www.ohaccess.com/sitemap.xml',
  }
}
