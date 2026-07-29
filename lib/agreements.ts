// Touring agreements / disclosures signed before entry (migration 043).
//
// Pure module (no Supabase/Resend/pdf-lib imports) so it can be unit-tested in
// isolation, like lib/custom-questions and lib/register-helpers. The PDF
// assembly itself lives in lib/agreement-pdf (it needs pdf-lib).
//
// Doctrine reminders that shape this file:
//   - The stored jsonb (profiles.agreement_templates,
//     open_houses.agreement_template_ids) is never trusted as-is — everything
//     is re-normalized on read, and malformed entries are DROPPED rather than
//     thrown: a bad row in settings must never break a visitor's sign-in.
//   - Fail OPEN for the visitor: if an open house requires an agreement but
//     none of its selected templates still resolve (agent deleted them), the
//     agreement step is skipped. The host sees the missing signature on the
//     dashboard and handles it at the door; software must not brick the queue.

export type AgreementTemplate = {
  id: string
  label: string
  path: string        // storage object path inside the agreement-templates bucket
  size: number        // bytes
  pages: number
  sha256: string
  uploaded_at: string
}

// A document snapshot on the receipt row: what was actually signed, hashable
// against a kept copy of the emailed PDF.
export type AgreementDocSnapshot = { label: string; sha256: string; pages: number }

// An agent stores at most 5 blank forms; one open house attaches at most 3 of
// them (agreement + a disclosure or two). Both caps are enforced here, not
// just in the UI, because the stored jsonb is the only thing the routes trust.
export const MAX_AGREEMENT_TEMPLATES = 5
export const MAX_OPEN_HOUSE_AGREEMENT_DOCS = 3
export const MAX_AGREEMENT_LABEL_LENGTH = 80
// 2 MB / 5 pages per template — "one page" forms with a little headroom. The
// byte cap is mirrored by the bucket's file_size_limit; the page cap keeps the
// merged signed PDF phone-readable and safely inside email attachment limits.
export const MAX_AGREEMENT_TEMPLATE_BYTES = 2 * 1024 * 1024
export const MAX_AGREEMENT_TEMPLATE_PAGES = 5
export const MAX_SIGNER_NAME_LENGTH = 120

// Coerce whatever is sitting in profiles.agreement_templates into a clean
// list. Follows normalizeCustomQuestions exactly: drop, don't throw.
export function normalizeAgreementTemplates(value: unknown): AgreementTemplate[] {
  if (!Array.isArray(value)) return []
  const out: AgreementTemplate[] = []
  const seenIds = new Set<string>()

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const t = raw as Record<string, unknown>
    if (typeof t.id !== 'string' || !t.id.trim()) continue
    if (typeof t.label !== 'string') continue
    if (typeof t.path !== 'string' || !t.path.trim()) continue
    if (typeof t.sha256 !== 'string' || !t.sha256.trim()) continue

    const id = t.id.trim()
    if (seenIds.has(id)) continue

    const label = t.label.trim().slice(0, MAX_AGREEMENT_LABEL_LENGTH)
    if (!label) continue

    const size = typeof t.size === 'number' && Number.isFinite(t.size) && t.size > 0 ? Math.floor(t.size) : 0
    const pages = typeof t.pages === 'number' && Number.isInteger(t.pages) && t.pages > 0 ? t.pages : 1
    const uploadedAt = typeof t.uploaded_at === 'string' ? t.uploaded_at : ''

    seenIds.add(id)
    out.push({ id, label, path: t.path.trim(), size, pages, sha256: t.sha256.trim(), uploaded_at: uploadedAt })
    if (out.length >= MAX_AGREEMENT_TEMPLATES) break
  }
  return out
}

// Resolve an open house's selected template ids against the agent's CURRENT
// template list. Unknown/stale ids are dropped (fail open — see header);
// order follows the open house's selection so the merged PDF reads in the
// order the agent arranged.
export function resolveAgreementDocs(
  templates: AgreementTemplate[],
  selectedIds: unknown
): AgreementTemplate[] {
  if (!Array.isArray(selectedIds)) return []
  const byId = new Map(templates.map(t => [t.id, t]))
  const out: AgreementTemplate[] = []
  const seen = new Set<string>()
  for (const raw of selectedIds) {
    if (typeof raw !== 'string') continue
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    const t = byId.get(id)
    if (!t) continue
    seen.add(id)
    out.push(t)
    if (out.length >= MAX_OPEN_HOUSE_AGREEMENT_DOCS) break
  }
  return out
}

// Validate the typed electronic signature. Kept deliberately loose: the
// E-SIGN bar is intent + attribution, not calligraphy, and the visitor's
// legal name may legitimately differ from the first/last they typed on the
// sign-in form (nicknames, transliteration, a middle name). Requiring at
// least two words filters out "x" and single-tap junk without ever blocking
// a real person at the door.
export function signerNameError(value: unknown): string | null {
  if (typeof value !== 'string') return 'Missing name'
  const name = value.trim().replace(/\s+/g, ' ')
  if (!name) return 'Missing name'
  if (name.length > MAX_SIGNER_NAME_LENGTH) return 'Name is too long'
  if (name.split(' ').length < 2) return 'Please type your full name'
  return null
}

// Normalized form of the typed name as it will appear on the certificate page
// and the receipt row. Call only after signerNameError returned null.
export function normalizeSignerName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_SIGNER_NAME_LENGTH)
}

// Magic-byte check: every real PDF starts with "%PDF-". The upload route runs
// this before trusting the client's content type.
export function looksLikePdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d    // -
  )
}

// Snapshot rows for the receipt's documents column.
export function buildDocSnapshots(docs: AgreementTemplate[]): AgreementDocSnapshot[] {
  return docs.map(d => ({ label: d.label, sha256: d.sha256, pages: d.pages }))
}
