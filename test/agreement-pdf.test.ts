import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildSignedAgreementPdf } from '@/lib/agreement-pdf'

// Build a tiny in-memory PDF with N blank pages to stand in for an uploaded
// template — the same shape the sign route feeds in.
async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([612, 792])
  return doc.save()
}

const baseInput = {
  signerName: 'Jane Q. Smith',
  visitorEmail: 'jane@example.com',
  agentName: 'Sarah Chen',
  agentBrokerage: 'Premier Realty Group',
  agentEmail: 'sarah@premierre.com',
  propertyAddress: '123 Main St, Dallas, TX 75201',
  openHouseDate: 'Sunday, August 2, 2026',
  signedAtIso: '2026-07-29T18:14:00Z',
  timezone: 'America/Chicago',
  ipAddress: '203.0.113.9',
  userAgent: 'Mozilla/5.0 (iPhone)',
  receiptId: 'r-123',
}

describe('buildSignedAgreementPdf', () => {
  it('merges every document and appends exactly one certificate page', async () => {
    const bytes = await buildSignedAgreementPdf({
      ...baseInput,
      docBytes: [await makePdf(1), await makePdf(2)],
      docs: [
        { label: 'Buyer Rep Agreement', sha256: 'aaa', pages: 1 },
        { label: 'Agency Disclosure', sha256: 'bbb', pages: 2 },
      ],
    })
    const merged = await PDFDocument.load(bytes)
    expect(merged.getPageCount()).toBe(1 + 2 + 1)
  })

  it('survives names/addresses with characters the standard fonts cannot encode', async () => {
    const bytes = await buildSignedAgreementPdf({
      ...baseInput,
      signerName: '张伟 Zhang Wei',
      propertyAddress: 'Śródmieście 12, Dallas, TX',
      docBytes: [await makePdf(1)],
      docs: [{ label: 'Touring Agreement', sha256: 'ccc', pages: 1 }],
    })
    const merged = await PDFDocument.load(bytes)
    expect(merged.getPageCount()).toBe(2)
  })

  it('handles a bogus stored timezone without throwing', async () => {
    const bytes = await buildSignedAgreementPdf({
      ...baseInput,
      timezone: 'Not/AZone',
      docBytes: [await makePdf(1)],
      docs: [{ label: 'Touring Agreement', sha256: 'ddd', pages: 1 }],
    })
    expect(bytes.length).toBeGreaterThan(0)
  })
})
