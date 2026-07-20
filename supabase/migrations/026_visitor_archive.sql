-- Visitor-log archive: when an AGENT deletes an open house, its visitor
-- records are copied here first, so a dashboard cleanup can't destroy the
-- record of who was inside a house (forensic/safety retention, allowed by
-- Privacy Policy §5: "up to 3 years from collection"). Rules:
--   * Agent-facing DELETE /api/open-house/[id] archives, then deletes.
--   * Admin delete tools stay TRUE hard-deletes (test cleanup + honoring
--     visitor data-deletion requests need a real purge path).
--   * Admin delete-account also wipes this archive for that agent —
--     the policy promises deletion "until the hosting Agent deletes their
--     account, whichever comes first."
--   * purge_after = original registration time + 3 years (collection-date
--     anchored, so archiving never extends the promised retention window).
-- No FKs on purpose: rows must survive open-house/profile deletion.
create table if not exists public.visitor_archive (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid,
  open_house_id uuid,
  agent_id uuid,
  property_address text,
  first_name text,
  last_name text,
  email text,
  phone text,
  purchasing_timeline text,
  source text,
  notes text,
  sms_opted_out boolean,
  ip_address text,
  user_agent text,
  phone_carrier text,
  phone_line_type text,
  registered_at timestamptz,
  deleted_at timestamptz not null default now(),
  purge_after timestamptz not null
);

create index if not exists visitor_archive_agent_id_idx on public.visitor_archive (agent_id);
create index if not exists visitor_archive_open_house_id_idx on public.visitor_archive (open_house_id);
create index if not exists visitor_archive_purge_after_idx on public.visitor_archive (purge_after);

-- Service-role only (same pattern as rate_limits / qr_scans): RLS on, no policies.
alter table public.visitor_archive enable row level security;
