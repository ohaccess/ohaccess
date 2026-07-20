-- Pre-registration scan log (Privacy Policy v1.2 — "Website Visitors"
-- automatic-collection disclosure): every load of a visitor registration
-- form records IP + user agent + timestamp, so a QR scan leaves a forensic
-- trail even when the visitor abandons the form. Deliberately NO foreign
-- keys — rows must survive open-house/account deletion to stay useful to a
-- later investigation, and this keeps the table out of the delete cascades.
create table if not exists public.qr_scans (
  id uuid primary key default gen_random_uuid(),
  open_house_id uuid,
  agent_id uuid,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists qr_scans_open_house_id_idx on public.qr_scans (open_house_id);
create index if not exists qr_scans_created_at_idx on public.qr_scans (created_at);

-- Service-role only (same pattern as rate_limits): RLS on, no policies.
alter table public.qr_scans enable row level security;
