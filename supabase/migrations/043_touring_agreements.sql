-- 043_touring_agreements.sql
-- Signed touring agreements / disclosures collected BEFORE entry, for open
-- houses where the host requires one (e.g. hosting another brokerage's listing
-- under post-settlement NAR rules).
--
-- Design doctrine — SEND AND FORGET:
--   ohACCESS never stores a signed document. The signed PDF is assembled in
--   memory (the agent's uploaded template(s) + a signature-certificate page),
--   emailed to the visitor and the host agent as an attachment, and discarded.
--   The ONLY durable record is one row in agreement_receipts — who signed
--   what, when, from where — with a sha256 of each document so the emailed
--   copies can later be proven authentic. This keeps ohACCESS out of the
--   business of being the custodian of legal records: the agent's inbox copy
--   is the official record, and the visitor holds their own copy (which also
--   satisfies the E-SIGN requirement that the signer can retain one).
--
-- profiles.agreement_templates: jsonb array of the agent's uploaded BLANK
-- forms (storing a blank form is settings, not a signed record):
--   [{"id":"<uuid>","label":"Buyer Rep Agreement","path":"<agentId>/<uuid>.pdf",
--     "size":123456,"pages":1,"sha256":"...","uploaded_at":"..."}]
-- Files live in the private 'agreement-templates' bucket (created below).
-- Caps (5 templates, 2 MB, 5 pages each) are enforced in application code and
-- re-validated on read via lib/agreements normalizeAgreementTemplates — the
-- stored jsonb is never trusted as-is (custom_questions doctrine).
--
-- open_houses.require_agreement + agreement_template_ids: the per-open-house
-- toggle and WHICH of the agent's templates apply (max 3). Ids are resolved
-- against the agent's current template list at sign-in time; ids that no
-- longer resolve are dropped, and if none resolve the agreement step is
-- skipped entirely — a settings change must never break a visitor's sign-in.
--
-- agreement_receipts: the one-line receipt. Deliberately has NO foreign keys:
-- it must survive the open house (and its visitors) being deleted from the
-- dashboard, because after the PDF is emailed and discarded this row is the
-- only evidence a signature ceremony happened. Signer name, emails, property
-- address, and per-document sha256/label are SNAPSHOTTED onto the row for the
-- same reason (visitors.sponsor_name / disclosures_sent doctrine).
--
-- Retention: purged by /api/cron/data-retention 3 years after signed_at, the
-- same Privacy Policy §5 window as visitor rows, and carries the legal_hold
-- flag from migration 041 (placed/released alongside visitors by
-- /api/admin/legal-hold). Since the receipt is the only evidence, the hold
-- flag matters MORE here, not less.
--
-- Safe to re-run.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS agreement_templates jsonb;

ALTER TABLE open_houses
  ADD COLUMN IF NOT EXISTS require_agreement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreement_template_ids jsonb;

CREATE TABLE IF NOT EXISTS agreement_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Plain uuids, not FKs — see header. visitor_id is UNIQUE: one signature
  -- ceremony per sign-in (write-once, like visitors.feedback_submitted_at).
  visitor_id uuid NOT NULL UNIQUE,
  open_house_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  -- Snapshots (survive later edits/deletes of everything they reference).
  signer_name text NOT NULL,            -- the typed electronic signature
  visitor_email text NOT NULL,
  agent_email text,
  property_address text,
  -- [{"label":"Buyer Rep Agreement","sha256":"...","pages":1}] — the exact
  -- documents merged into the emailed PDF, hashable against a kept copy.
  documents jsonb NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  -- Security metadata (Privacy Policy §2), same as visitors.
  ip_address text,
  user_agent text,
  -- Resend message id of the signed-copy email (visitor + agent share one
  -- send), so delivery can be traced in the Resend dashboard if disputed.
  email_message_id text,
  legal_hold boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS agreement_receipts_open_house_idx
  ON agreement_receipts (open_house_id);
CREATE INDEX IF NOT EXISTS agreement_receipts_agent_idx
  ON agreement_receipts (agent_id);
-- The retention purge deletes by signed_at.
CREATE INDEX IF NOT EXISTS agreement_receipts_signed_at_idx
  ON agreement_receipts (signed_at);

ALTER TABLE agreement_receipts ENABLE ROW LEVEL SECURITY;

-- Agents may READ their own receipts (the dashboard's signed/unsigned chip);
-- all writes go through API routes with the service-role key, so there are
-- deliberately no insert/update/delete policies (short_urls pattern).
DROP POLICY IF EXISTS "Agents read own agreement receipts" ON agreement_receipts;
CREATE POLICY "Agents read own agreement receipts" ON agreement_receipts
  FOR SELECT USING (auth.uid() = agent_id);

-- PRIVATE bucket for the blank templates. Unlike brokerage-logos this is not
-- public: the documents are only served through tokenized API routes (the
-- signing visitor's one-time token, or the owning agent). No object-level RLS
-- policies — all reads/writes go through our API routes using the service-role
-- key, which check permission first (migration 006 convention).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agreement-templates',
  'agreement-templates',
  false,
  2 * 1024 * 1024,  -- 2 MB max — a one-page form; also enforced in the API
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
