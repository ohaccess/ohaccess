# ohACCESS → CRM Integration Gameplan

_Last updated: 2026-06-27_

## Goal
Push verified open-house visitor sign-ins from ohACCESS into the real estate CRM
each agent already uses, so leads land where agents work — automatically.

## What we already have (foundation)
- Per-agent **Zapier webhook** (`profiles.zapier_webhook_url`, migration 013),
  fired best-effort in `app/api/register/route.ts` after a visitor is inserted.
- Proven outbound infra: **Resend** (email), **Twilio** (SMS), **Stripe** webhooks,
  delivery-status tracking on the `visitors` table.
- Multi-tenant model: every signup is keyed to an `agent_id`; brokerages exist as
  a parent (`brokerages` table). CRM settings can live per-agent or per-brokerage.

## The data we'd send a CRM (from the `visitors` row)
first_name, last_name, email, phone, purchasing_timeline, registered_at,
property_address (via open_house), agent_name, verified, notes, source='ohaccess'.

---

## Top 10 CRMs by real-world usage (2026)
| # | CRM | Segment | Direct API | Integration path |
|---|-----|---------|-----------|------------------|
| 1 | Follow Up Boss (Zillow) | High-volume agents/teams | Best-in-class | API + `@followupboss.me` parse email + Zapier |
| 2 | BoldTrail (ex-kvCORE) | Brokerages at scale | Partner-gated | Email/lead delivery + Zapier; API needs partner approval |
| 3 | Lofty (ex-Chime) | AI-forward | Partner program | Email + Zapier; API via partner program |
| 4 | Sierra Interactive | IDX-heavy teams | Yes | API + Zapier + email |
| 5 | Real Geeks | Solo/small teams | Open API | API + Zapier + email |
| 6 | CINC | Lead-gen teams | Partner-gated | Email + Zapier; API needs partner approval |
| 7 | Top Producer | Long-tail | Yes | API + Zapier + email |
| 8 | Wise Agent | Budget solo | Open, documented | Easiest small API |
| 9 | LionDesk (Lone Wolf) | Declining | Legacy | Low priority |
| 10 | BoomTown (Inside RE) | Teams | Merged w/ BoldTrail | Treat as BoldTrail family |

## Three integration mechanisms (not ten)
1. **Email parse — universal.** Every CRM issues each user a unique lead-intake
   email. The real-estate [Lead Metadata Spec](https://www.leadmetadata.org/)
   embeds structured fields in a human-readable email so CRMs auto-file it.
   One build → ~all CRMs.
2. **Zapier — already built.** `zapier_webhook_url` routes anywhere.
3. **Native API — best UX, most work, often partner-gated.** Real-time, two-way,
   ohACCESS-branded.

---

## Phased rollout

### Phase 1 — Universal "Send to my CRM" via email parse  ← START HERE
- New settings: `crm_type` (enum) + `crm_lead_email` (text) on `profiles`
  (optionally on `brokerages` as a default).
- On signup, send a lead-formatted email (Lead Metadata Spec + clean plaintext)
  to `crm_lead_email` via Resend, alongside existing notifications.
- Covers all 10 CRMs in one build. Don't block registration; best-effort + log.
- Effort: ~days.

### Phase 2 — Native Follow Up Boss API
- Biggest market share among serious agents + best API. Premium "real" integration
  and a marketing bullet. API key or OAuth; map fields; two-way later.

### Phase 3 — Native APIs for the open ones
- Real Geeks, Sierra Interactive, Wise Agent, Top Producer.

### Phase 4 — Partner-gated platforms
- BoldTrail/kvCORE, CINC, Lofty. **Apply to partner programs NOW, in parallel** —
  approval is the slow part, not the code.

## Cross-cutting engineering notes
- **Reliability:** CRM push must never block or fail a visitor signup. Best-effort
  with timeout + logged failures now; consider a small retry/queue (pg-boss or a
  Vercel cron sweeping un-pushed visitors) before scaling.
- **Credential storage:** new `crm_connections` table (agent_id/brokerage_id,
  crm_type, lead_email, api_key/token encrypted, enabled, created_at) — cleaner
  than piling columns on `profiles`.
- **Field mapping:** standardize an internal lead payload once; adapt per CRM.
- **Settings UI:** add a "CRM / Integrations" section to agent settings with a
  per-CRM setup guide (where to find their lead email / API key).
- **Decision:** per-agent settings, with optional brokerage-level default.

## Decisions (2026-06-27)
- **Pricing:** CRM integration is **free on all tiers** — adoption/stickiness lever.
- **Native CRM order:** TBD. Start with universal Phase 1; let real demand (which
  CRMs customers actually paste in) decide Phase 2/3 order rather than market share.
- **Settings scope:** per-agent, with optional brokerage default (still to confirm).

## Open questions
1. Per-agent only, or brokerage-level defaults too?
