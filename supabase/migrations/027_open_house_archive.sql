-- Open-house archive: when an AGENT deletes an open house, its listing
-- record is copied here (alongside the visitor_archive copy of its
-- visitors) so lifetime marketing stats — open houses created, visitors
-- logged — survive dashboard cleanup. Listing data is business data, not
-- visitor PII, so unlike visitor_archive there is NO retention purge.
-- Admin delete tools stay true hard-deletes and do not write here.
-- No FKs on purpose: rows must survive profile deletion.
create table if not exists public.open_house_archive (
  id uuid primary key default gen_random_uuid(),
  open_house_id uuid,
  agent_id uuid,
  property_address text,
  street_address text,
  listing_price text,
  start_at timestamptz,
  end_at timestamptz,
  visitor_count integer not null default 0,
  oh_created_at timestamptz,
  deleted_at timestamptz not null default now()
);

create index if not exists open_house_archive_agent_id_idx on public.open_house_archive (agent_id);
create index if not exists open_house_archive_oh_created_at_idx on public.open_house_archive (oh_created_at);

-- Service-role only (same pattern as visitor_archive): RLS on, no policies.
alter table public.open_house_archive enable row level security;
