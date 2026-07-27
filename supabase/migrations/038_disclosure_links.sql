-- 038_disclosure_links.sql
-- Agent-supplied disclosure/notice links, delivered to the visitor.
--
-- ohACCESS is plumbing here, not a compliance authority: the agent (or their
-- brokerage) supplies BOTH the label and the URL for whatever notice their
-- state or broker requires -- an IABS, a Consumer Information Statement, an
-- agency disclosure. We render the links on the sign-in success screen and in
-- the code-word email, and record what was sent. We never decide which form
-- applies, host the document, or collect a signature.
--
-- Shape (profiles + brokerages): jsonb array of {"label": text, "url": text}
--   [{"label":"Information About Brokerage Services","url":"https://..."}]
-- NULL or [] means none configured, and nothing is shown to the visitor.
-- Rows are re-validated on read (lib/register-helpers normalizeDisclosureLinks,
-- https-only) -- the stored jsonb is never trusted as-is.
--
-- Brokerage links OVERRIDE agent links, matching the existing logo/colors
-- precedence: what gets handed to a visitor is a broker-level control, not an
-- individual agent preference.
--
-- visitors.disclosures_sent is a SNAPSHOT of the resolved list at send time,
-- so a later edit in Settings can never rewrite what a past visitor was told
-- they received. Same reasoning as the existing sponsor_name snapshot.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS disclosure_links jsonb;

ALTER TABLE brokerages
  ADD COLUMN IF NOT EXISTS disclosure_links jsonb;

ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS disclosures_sent jsonb;
