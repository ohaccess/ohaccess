-- ============================================================================
-- Migration 006: Public Supabase Storage bucket for brokerage logos
-- ============================================================================
-- What this does:
--   1. Creates a public storage bucket 'brokerage-logos'
--   2. No object-level RLS policies — all writes go through our API routes
--      using the service-role key, which checks brokerage_admin permission
--      before uploading. Bucket-level public flag handles read access.
--
-- Safe to re-run.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brokerage-logos',
  'brokerage-logos',
  true,
  2 * 1024 * 1024,  -- 2 MB max
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
