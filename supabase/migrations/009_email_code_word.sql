-- ============================================================================
-- Migration 009: Separate code word for the email channel
-- ============================================================================
-- Open houses now carry TWO code words:
--   - code_word        → sent via SMS  (the primary, harder-to-spoof code)
--   - code_word_email  → sent via email (a fallback the host may accept)
--
-- Giving each channel a different word lets the host ask specifically for the
-- TEXT code, which proves the visitor has a real, reachable phone (much harder
-- to fake than a throwaway email).
--
-- Backward compatible: existing open houses keep their single code_word. When
-- code_word_email is NULL the email simply reuses code_word, so old links keep
-- working exactly as before.
-- ============================================================================

ALTER TABLE open_houses
  ADD COLUMN IF NOT EXISTS code_word_email TEXT;
