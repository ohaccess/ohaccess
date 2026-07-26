import type { MetadataRoute } from 'next'

const BASE = 'https://www.ohaccess.com'

// The public, indexable pages. App surfaces and per-link pages (register,
// report, map) are deliberately absent — see robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, priority: 1 },
    { url: `${BASE}/resources`, priority: 0.8 },
    { url: `${BASE}/faq`, priority: 0.7 },
    { url: `${BASE}/partners`, priority: 0.8 },
    { url: `${BASE}/gift`, priority: 0.7 },
    { url: `${BASE}/contact`, priority: 0.6 },
    { url: `${BASE}/terms`, priority: 0.3 },
    { url: `${BASE}/privacy`, priority: 0.3 },
    { url: `${BASE}/subscriber-terms`, priority: 0.3 },
  ]
}
