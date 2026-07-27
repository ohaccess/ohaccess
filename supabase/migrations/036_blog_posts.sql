-- 036_blog_posts.sql
-- SEO blog articles auto-published by GrandRanker via webhook
-- (POST /api/webhooks/grandranker). One row per article; the webhook upserts
-- on grandranker_id so an edited article republished by GrandRanker updates
-- in place instead of duplicating. `raw` keeps the full payload so fields we
-- don't map yet (video_embeds, etc.) are never lost.
--
-- Safe to re-run: everything is IF NOT EXISTS.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  grandranker_id text not null,      -- GrandRanker's article id (upsert key)
  slug text not null,                -- URL path: /blog/<slug>
  title text not null,
  meta_title text,                   -- <title> tag override
  subtitle text,
  meta_description text,
  content_html text not null,        -- sanitized in the webhook before insert
  content_markdown text,
  image_url text,
  category text,
  read_time text,                    -- display string, e.g. "8 min read"
  word_count integer,
  author_name text,
  author_title text,
  tags jsonb not null default '[]'::jsonb,
  faqs jsonb not null default '[]'::jsonb,                 -- [{name, answer}]
  recommended_articles jsonb not null default '[]'::jsonb, -- GrandRanker cross-links (rendered only if the slug exists here)
  raw jsonb,                         -- full article object as received
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists blog_posts_grandranker_id_idx
  on public.blog_posts (grandranker_id);

create unique index if not exists blog_posts_slug_idx
  on public.blog_posts (slug);

-- Blog index page sorts newest-first.
create index if not exists blog_posts_published_at_idx
  on public.blog_posts (published_at desc);

-- Service-role only (matches email_opt_outs / rate_limits): RLS on, no
-- policies. The public blog pages render server-side through supabaseAdmin.
alter table public.blog_posts enable row level security;
