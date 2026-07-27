import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import Footer from '../../_components/Footer'

export const dynamic = 'force-dynamic'

const BASE = 'https://www.ohaccess.com'

type Faq = { name?: string; answer?: string }
type RecommendedArticle = { title?: string; slug?: string; category?: string; read_time?: string }
type PostRow = {
  slug: string
  title: string
  meta_title: string | null
  subtitle: string | null
  meta_description: string | null
  content_html: string
  image_url: string | null
  category: string | null
  read_time: string | null
  author_name: string | null
  author_title: string | null
  faqs: Faq[]
  recommended_articles: RecommendedArticle[]
  published_at: string
  updated_at: string
}

async function getPost(slug: string): Promise<PostRow | null> {
  const { data } = await supabase
    .from('blog_posts')
    .select('slug, title, meta_title, subtitle, meta_description, content_html, image_url, category, read_time, author_name, author_title, faqs, recommended_articles, published_at, updated_at')
    .eq('slug', slug.toLowerCase())
    .single()
  return data
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'Article not found' }
  return {
    title: post.meta_title ?? post.title,
    description: post.meta_description ?? post.subtitle ?? undefined,
    alternates: { canonical: `${BASE}/blog/${post.slug}` },
    openGraph: {
      title: post.meta_title ?? post.title,
      description: post.meta_description ?? post.subtitle ?? undefined,
      type: 'article',
      url: `${BASE}/blog/${post.slug}`,
      images: post.image_url ? [post.image_url] : undefined,
    },
  }
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const faqs = (post.faqs ?? []).filter((f) => f.name && f.answer)

  // Only cross-link recommended articles that actually exist on our site —
  // GrandRanker's list can reference articles it hasn't published here yet.
  const recommendedSlugs = (post.recommended_articles ?? [])
    .map((r) => r.slug?.toLowerCase())
    .filter((s): s is string => Boolean(s))
  let recommended: RecommendedArticle[] = []
  if (recommendedSlugs.length > 0) {
    const { data: existing } = await supabase
      .from('blog_posts')
      .select('slug, title, category, read_time')
      .in('slug', recommendedSlugs)
    recommended = existing ?? []
  }

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.meta_description ?? undefined,
    image: post.image_url ?? undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: post.author_name
      ? { '@type': 'Person', name: post.author_name, jobTitle: post.author_title ?? undefined }
      : { '@type': 'Organization', name: 'ohACCESS' },
    publisher: { '@type': 'Organization', name: 'ohACCESS', url: BASE },
    mainEntityOfPage: `${BASE}/blog/${post.slug}`,
  }
  const faqSchema = faqs.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.name,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      }
    : null

  return (
    <main style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#ffffff', color: '#1d1d1f', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet" />
      {/* Typography for the injected article HTML — inline styles can't reach it. */}
      <style>{`
        .gr-article { font-size: 16px; line-height: 1.75; color: #313136; }
        .gr-article h1 { display: none; } /* page renders its own H1 */
        .gr-article h2 { font-size: 24px; font-weight: 700; letter-spacing: -0.3px; color: #1d1d1f; margin: 36px 0 12px; }
        .gr-article h3 { font-size: 19px; font-weight: 700; color: #1d1d1f; margin: 28px 0 10px; }
        .gr-article p { margin: 0 0 16px; }
        .gr-article ul, .gr-article ol { margin: 0 0 16px; padding-left: 24px; }
        .gr-article ul { list-style: disc; }
        .gr-article ol { list-style: decimal; }
        .gr-article li { margin-bottom: 8px; }
        .gr-article a { color: #0071e3; text-decoration: none; }
        .gr-article img { max-width: 100%; height: auto; border-radius: 10px; }
        .gr-article blockquote { border-left: 3px solid #c9963a; margin: 0 0 16px; padding: 4px 0 4px 18px; color: #48484a; }
        .gr-article table { border-collapse: collapse; width: 100%; margin: 0 0 16px; font-size: 14px; }
        .gr-article th, .gr-article td { border: 1px solid #ececf0; padding: 8px 12px; text-align: left; }
      `}</style>

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

      <article style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px 0' }}>
        <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '18px' }}>
          <Link href="/blog" style={{ color: '#0071e3', textDecoration: 'none' }}>← All articles</Link>
        </div>
        <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#c9963a', marginBottom: '10px' }}>
          {[post.category, post.read_time].filter(Boolean).join(' · ')}
        </div>
        <h1 style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 10px', lineHeight: 1.25 }}>
          {post.title}
        </h1>
        {post.subtitle && (
          <p style={{ fontSize: '17px', color: '#6e6e73', margin: '0 0 14px', lineHeight: 1.6 }}>{post.subtitle}</p>
        )}
        <div style={{ fontSize: '13px', color: '#6e6e73', marginBottom: '28px' }}>
          {[post.author_name, formatDate(post.published_at)].filter(Boolean).join(' · ')}
        </div>
        {post.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt={post.title}
            style={{ width: '100%', borderRadius: '14px', marginBottom: '32px' }}
          />
        )}

        <div className="gr-article" dangerouslySetInnerHTML={{ __html: post.content_html }} />

        {faqs.length > 0 && (
          <section style={{ marginTop: '40px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.3px', margin: '0 0 4px' }}>
              Frequently asked questions
            </h2>
            {faqs.map((f) => (
              <div key={f.name} style={{ padding: '18px 0', borderBottom: '1px solid #ececf0' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 8px' }}>{f.name}</h3>
                <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#48484a', margin: 0 }}>{f.answer}</p>
              </div>
            ))}
          </section>
        )}

        {recommended.length > 0 && (
          <section style={{ marginTop: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.3px', margin: '0 0 12px' }}>
              Keep reading
            </h2>
            {recommended.map((r) => (
              <Link key={r.slug} href={`/blog/${r.slug}`} style={{ display: 'block', padding: '14px 0', borderTop: '1px solid #ececf0', textDecoration: 'none' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#c9963a', marginBottom: '4px' }}>
                  {[r.category, r.read_time].filter(Boolean).join(' · ')}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1d1d1f' }}>{r.title}</div>
              </Link>
            ))}
          </section>
        )}

        {/* CTA */}
        <div style={{ borderTop: '1px solid #ececf0', marginTop: '40px', paddingTop: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Ready to verify your next open house?</div>
          <p style={{ fontSize: '15px', color: '#6e6e73', margin: '0 0 18px' }}>Start free with 25 verified check-ins — no credit card required.</p>
          <Link href="/login?signup=true" style={{ display: 'inline-block', background: '#c9963a', color: '#1d1d1f', padding: '12px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 700, textDecoration: 'none' }}>
            Start Free
          </Link>
        </div>
      </article>

      <Footer />
    </main>
  )
}
