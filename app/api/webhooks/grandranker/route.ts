import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TOKEN = process.env.GRANDRANKER_WEBHOOK_TOKEN

// GrandRanker authenticates with a static bearer token (the same value is
// pasted into their webhook config and into Vercel env). No token configured
// means the endpoint is closed, not open.
function authorized(request: Request): boolean {
  if (!TOKEN) {
    console.error('GRANDRANKER_WEBHOOK_TOKEN not set — rejecting webhook')
    return false
  }
  const presented = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(presented)
  const b = Buffer.from(TOKEN)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// The article HTML is trusted-ish (it only arrives with the bearer token),
// but it is still third-party generated content rendered with
// dangerouslySetInnerHTML — strip anything executable before it touches the DB.
function stripUnsafeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?(?:<\/iframe>|\/>)/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi, '')
}

type GrandRankerArticle = {
  id?: string | number
  title?: string
  meta_title?: string
  subtitle?: string
  content_html?: string
  content_markdown?: string
  meta_description?: string
  image_url?: string
  category?: string
  read_time?: string
  word_count?: number
  author_name?: string
  author_title?: string
  slug?: string
  tags?: unknown
  faqs?: unknown
  recommended_articles?: unknown
  created_at?: string
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let event: { event_type?: string; data?: { articles?: GrandRankerArticle[] } }
  try {
    event = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const articles = event.data?.articles
  if (event.event_type !== 'publish_articles' || !Array.isArray(articles)) {
    // Unknown event shape — acknowledge so GrandRanker stops retrying.
    return NextResponse.json({ ok: true, ignored: true })
  }

  let saved = 0
  const failed: string[] = []
  for (const article of articles) {
    const slug = article.slug?.trim().toLowerCase()
    if (!article.id || !slug || !article.title || !article.content_html) {
      failed.push(String(article.id ?? article.slug ?? 'unknown'))
      continue
    }

    const publishedAt = article.created_at && !Number.isNaN(Date.parse(article.created_at))
      ? new Date(article.created_at).toISOString()
      : new Date().toISOString()

    const { error } = await supabase.from('blog_posts').upsert(
      {
        grandranker_id: String(article.id),
        slug,
        title: article.title,
        meta_title: article.meta_title ?? null,
        subtitle: article.subtitle ?? null,
        meta_description: article.meta_description ?? null,
        content_html: stripUnsafeHtml(article.content_html),
        content_markdown: article.content_markdown ?? null,
        image_url: article.image_url ?? null,
        category: article.category ?? null,
        read_time: article.read_time ?? null,
        word_count: article.word_count ?? null,
        author_name: article.author_name ?? null,
        author_title: article.author_title ?? null,
        tags: Array.isArray(article.tags) ? article.tags : [],
        faqs: Array.isArray(article.faqs) ? article.faqs : [],
        recommended_articles: Array.isArray(article.recommended_articles)
          ? article.recommended_articles
          : [],
        raw: article,
        published_at: publishedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'grandranker_id' }
    )

    if (error) {
      console.error(`GrandRanker webhook: failed to save article ${article.id}`, error)
      failed.push(String(article.id))
    } else {
      saved++
    }
  }

  // Nothing saved and at least one real failure → 500 so GrandRanker retries.
  if (saved === 0 && failed.length > 0) {
    return NextResponse.json({ error: 'All articles failed', failed }, { status: 500 })
  }
  return NextResponse.json({ ok: true, saved, failed })
}
