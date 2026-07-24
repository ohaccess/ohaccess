-- 033_visitor_lang.sql
-- The language the visitor chose on the sign-in form (en/es/vi/zh/ko/hi).
-- Surfaced as a flag next to their name in the agent dashboard so agents can
-- see at a glance who may prefer another language. Nullable; the app treats a
-- null/unknown value as English for display (older rows predate this column).

ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS lang text;
