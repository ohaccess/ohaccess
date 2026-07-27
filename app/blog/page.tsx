import type { Metadata } from 'next'
import Link from 'next/link'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import Footer from '../_components/Footer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Open House & Real Estate Blog | ohACCESS',
  description:
    'Guides and tips on open houses, verified sign-ins, lead capture, and real estate marketing from ohACCESS.',
}

type PostRow = {
  slug: string
  title: string
  subtitle: string | null
  meta_description: string | null
  image_url: string | null
  category: string | null
  read_time: string | null
  published_at: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}

export default async function BlogIndex() {
  // Newest first. `data` is null before the blog_posts migration has run —
  // render the empty state instead of crashing.
  const { data } = await supabase
    .from('blog_posts')
    .select('slug, title, subtitle, meta_description, image_url, category, read_time, published_at')
    .order('published_at', { ascending: false })
  const posts: PostRow[] = data ?? []

  return (
    <main style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#ffffff', color: '#1d1d1f', minHeight: '100vh' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{ background: '#1d1d1f', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: '22px', fontWeight: 200, color: 'white', letterSpacing: '-0.5px' }}>
            oh<span style={{ fontWeight: 700 }}>ACCESS</span>
          </div>
        </Link>
        <Link href="/login?signup=true" style={{ background: '#c9963a', color: '#1d1d1f', padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
          Start Free
        </Link>
      </nav>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#c9963a', marginBottom: '10px' }}>
          Blog
        </div>
        <h1 style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 8px' }}>
          Open house &amp; real estate insights
        </h1>
        <p style={{ fontSize: '16px', color: '#6e6e73', margin: '0 0 8px', lineHeight: 1.6 }}>
          Guides on open houses, lead capture, and growing your real estate business.
        </p>

        {posts.length === 0 ? (
          <p style={{ marginTop: '32px', fontSize: '15px', color: '#6e6e73' }}>
            No articles yet — check back soon.
          </p>
        ) : (
          <div style={{ marginTop: '24px' }}>
            {posts.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <article style={{ display: 'flex', gap: '20px', padding: '24px 0', borderTop: '1px solid #ececf0', alignItems: 'flex-start' }}>
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.title}
                      style={{ width: '140px', height: '94px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }}
                    />
                  )}
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#c9963a', marginBottom: '6px' }}>
                      {[p.category, p.read_time].filter(Boolean).join(' · ')}
                    </div>
                    <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 6px', lineHeight: 1.35 }}>{p.title}</h2>
                    <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#48484a', margin: '0 0 6px' }}>
                      {p.subtitle ?? p.meta_description ?? ''}
                    </p>
                    <div style={{ fontSize: '13px', color: '#6e6e73' }}>{formatDate(p.published_at)}</div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </main>
  )
}
