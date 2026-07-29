import { describe, it, expect } from 'vitest'
import {
  normalizeAgreementTemplates,
  resolveAgreementDocs,
  signerNameError,
  normalizeSignerName,
  looksLikePdf,
  buildDocSnapshots,
  MAX_AGREEMENT_TEMPLATES,
  MAX_OPEN_HOUSE_AGREEMENT_DOCS,
  MAX_AGREEMENT_LABEL_LENGTH,
  MAX_SIGNER_NAME_LENGTH,
  type AgreementTemplate,
} from '@/lib/agreements'

const tpl = (id: string, label = `Doc ${id}`): AgreementTemplate => ({
  id, label, path: `agent/${id}.pdf`, size: 1000, pages: 1,
  sha256: `hash-${id}`, uploaded_at: '2026-07-29T00:00:00Z',
})

describe('normalizeAgreementTemplates', () => {
  it('returns [] for anything that is not an array', () => {
    expect(normalizeAgreementTemplates(null)).toEqual([])
    expect(normalizeAgreementTemplates(undefined)).toEqual([])
    expect(normalizeAgreementTemplates('nope')).toEqual([])
    expect(normalizeAgreementTemplates({ id: 't1' })).toEqual([])
  })

  it('keeps a well-formed template and trims the label', () => {
    expect(normalizeAgreementTemplates([
      { id: 't1', label: '  Buyer Rep  ', path: 'a/t1.pdf', size: 500, pages: 2, sha256: 'abc', uploaded_at: 'x' },
    ])).toEqual([
      { id: 't1', label: 'Buyer Rep', path: 'a/t1.pdf', size: 500, pages: 2, sha256: 'abc', uploaded_at: 'x' },
    ])
  })

  it('drops rows missing id, label, path, or sha256', () => {
    expect(normalizeAgreementTemplates([
      { label: 'No id', path: 'p', sha256: 's' },
      { id: 't1', label: '   ', path: 'p', sha256: 's' },
      { id: 't2', label: 'No path', sha256: 's' },
      { id: 't3', label: 'No hash', path: 'p' },
    ])).toEqual([])
  })

  it('drops duplicate ids and caps the list', () => {
    const rows = Array.from({ length: MAX_AGREEMENT_TEMPLATES + 3 }, (_, i) => tpl(`t${i}`))
    rows.push(tpl('t0'))
    const got = normalizeAgreementTemplates(rows)
    expect(got).toHaveLength(MAX_AGREEMENT_TEMPLATES)
    expect(new Set(got.map(t => t.id)).size).toBe(MAX_AGREEMENT_TEMPLATES)
  })

  it('caps the label length and defaults bad size/pages', () => {
    const got = normalizeAgreementTemplates([
      { id: 't1', label: 'x'.repeat(200), path: 'p', sha256: 's', size: -5, pages: 'two' },
    ])
    expect(got[0].label).toHaveLength(MAX_AGREEMENT_LABEL_LENGTH)
    expect(got[0].size).toBe(0)
    expect(got[0].pages).toBe(1)
  })
})

describe('resolveAgreementDocs', () => {
  const templates = [tpl('a'), tpl('b'), tpl('c'), tpl('d')]

  it('returns [] for a non-array selection', () => {
    expect(resolveAgreementDocs(templates, null)).toEqual([])
    expect(resolveAgreementDocs(templates, 'a')).toEqual([])
  })

  it('resolves in SELECTION order and drops unknown/stale ids', () => {
    const got = resolveAgreementDocs(templates, ['c', 'deleted', 'a'])
    expect(got.map(t => t.id)).toEqual(['c', 'a'])
  })

  it('dedupes and caps at the per-open-house limit', () => {
    const got = resolveAgreementDocs(templates, ['a', 'a', 'b', 'c', 'd'])
    expect(got.map(t => t.id)).toEqual(['a', 'b', 'c'])
    expect(got).toHaveLength(MAX_OPEN_HOUSE_AGREEMENT_DOCS)
  })

  it('fails open: every id stale means no documents (step is skipped)', () => {
    expect(resolveAgreementDocs(templates, ['x', 'y'])).toEqual([])
    expect(resolveAgreementDocs([], ['a'])).toEqual([])
  })
})

describe('signerNameError', () => {
  it('accepts a normal full name', () => {
    expect(signerNameError('Jane Smith')).toBeNull()
    expect(signerNameError('  María  del Carmen  ')).toBeNull()
  })

  it('rejects empty, one-word, and non-string input', () => {
    expect(signerNameError('')).toBeTruthy()
    expect(signerNameError('   ')).toBeTruthy()
    expect(signerNameError('Jane')).toBeTruthy()
    expect(signerNameError(42)).toBeTruthy()
    expect(signerNameError(undefined)).toBeTruthy()
  })

  it('rejects an absurdly long name', () => {
    expect(signerNameError(`${'a'.repeat(MAX_SIGNER_NAME_LENGTH)} b`)).toBeTruthy()
  })
})

describe('normalizeSignerName', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeSignerName('  Jane   Q.  Smith ')).toBe('Jane Q. Smith')
  })
})

describe('looksLikePdf', () => {
  it('accepts bytes starting with %PDF-', () => {
    expect(looksLikePdf(new TextEncoder().encode('%PDF-1.7 rest of file'))).toBe(true)
  })

  it('rejects anything else', () => {
    expect(looksLikePdf(new TextEncoder().encode('<html>not a pdf'))).toBe(false)
    expect(looksLikePdf(new Uint8Array([0x25, 0x50]))).toBe(false)
    expect(looksLikePdf(new Uint8Array())).toBe(false)
  })
})

describe('buildDocSnapshots', () => {
  it('snapshots label, hash, and page count only', () => {
    expect(buildDocSnapshots([tpl('a', 'Buyer Rep')])).toEqual([
      { label: 'Buyer Rep', sha256: 'hash-a', pages: 1 },
    ])
  })
})
