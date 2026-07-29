import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'
import type { AgreementDocSnapshot } from './agreements'

// Assembles the signed agreement PDF ENTIRELY IN MEMORY: the agent's uploaded
// document(s) merged in order, then one appended signature-certificate page.
// The caller emails the returned bytes and discards them — nothing here (or
// anywhere) writes the signed document to disk or storage (send-and-forget
// doctrine, migration 043).
//
// The signature is a TYPED name. Under E-SIGN/UETA the signature is the act +
// intent, not the glyphs; the certificate page records the attribution trail
// (who, what, when, from where, hash of each document) that makes the emailed
// copies provable later.

export type SignedAgreementInput = {
  // Raw bytes of each template, in merge order, matching docs[] below.
  docBytes: Uint8Array[]
  docs: AgreementDocSnapshot[]
  signerName: string
  visitorEmail: string
  agentName: string
  agentBrokerage: string
  agentEmail: string
  propertyAddress: string
  openHouseDate: string
  signedAtIso: string
  timezone: string      // the property's IANA timezone, for the display time
  ipAddress: string
  userAgent: string
  receiptId: string
}

// US Letter, like the forms it's appended to.
const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 54

export async function buildSignedAgreementPdf(input: SignedAgreementInput): Promise<Uint8Array> {
  const out = await PDFDocument.create()

  // Merge the agent's documents in order. Encrypted PDFs were rejected at
  // upload time, so a load failure here is unexpected — let it throw and the
  // sign route return a retryable error rather than emailing a partial file.
  for (const bytes of input.docBytes) {
    const src = await PDFDocument.load(bytes)
    const pages = await out.copyPages(src, src.getPageIndices())
    for (const p of pages) out.addPage(p)
  }

  const helv = await out.embedFont(StandardFonts.Helvetica)
  const helvBold = await out.embedFont(StandardFonts.HelveticaBold)
  // Italic stands in for a script face so the typed signature still reads as
  // a signature without shipping a font file.
  const italic = await out.embedFont(StandardFonts.TimesRomanItalic)

  const page = out.addPage([PAGE_W, PAGE_H])
  const gray = rgb(0.42, 0.42, 0.45)
  const black = rgb(0.11, 0.11, 0.12)
  let y = PAGE_H - MARGIN - 10

  const drawWrapped = (
    text: string, font: PDFFont, size: number, color = black, lineGap = 4
  ) => {
    // Simple greedy wrap — certificate text is plain ASCII-ish metadata, and
    // any character the standard fonts can't encode is replaced rather than
    // allowed to throw mid-signature.
    const safe = sanitizeForFont(text, font)
    const maxWidth = PAGE_W - MARGIN * 2
    const words = safe.split(' ')
    let line = ''
    const flush = () => {
      if (!line) return
      page.drawText(line, { x: MARGIN, y, size, font, color })
      y -= size + lineGap
      line = ''
    }
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) flush()
      line = line ? `${line} ${word}` : word
    }
    flush()
  }
  const gap = (px: number) => { y -= px }
  const rule = () => {
    page.drawLine({
      start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_W - MARGIN, y: y + 4 },
      thickness: 0.75, color: rgb(0.82, 0.82, 0.84),
    })
    gap(14)
  }

  drawWrapped('Signature Certificate', helvBold, 20)
  gap(2)
  drawWrapped('Electronic signature collected at open house check-in via ohACCESS (ohaccess.com)', helv, 9, gray)
  gap(10)
  rule()

  drawWrapped('Signed by', helv, 9, gray)
  drawWrapped(input.signerName, italic, 26)
  gap(2)
  drawWrapped(`${input.signerName}  ·  ${input.visitorEmail}`, helv, 10)
  gap(14)

  const field = (label: string, value: string) => {
    if (!value) return
    drawWrapped(label, helv, 9, gray)
    drawWrapped(value, helv, 11)
    gap(8)
  }

  field('Property', input.propertyAddress)
  field('Open house date', input.openHouseDate)
  field(
    'Host agent',
    [input.agentName, input.agentBrokerage, input.agentEmail].filter(Boolean).join('  ·  ')
  )
  field('Signed at', formatSignedAt(input.signedAtIso, input.timezone))
  gap(6)
  rule()

  drawWrapped('Documents covered by this signature', helv, 9, gray)
  gap(2)
  input.docs.forEach((d, i) => {
    drawWrapped(`${i + 1}. ${d.label}  (${d.pages} page${d.pages === 1 ? '' : 's'})`, helvBold, 11)
    drawWrapped(`SHA-256 ${d.sha256}`, helv, 8, gray)
    gap(6)
  })
  gap(6)
  rule()

  drawWrapped('Verification record', helv, 9, gray)
  gap(2)
  drawWrapped(`Receipt ID: ${input.receiptId}`, helv, 9)
  drawWrapped(`IP address: ${input.ipAddress || 'unavailable'}`, helv, 9)
  drawWrapped(`Device: ${(input.userAgent || 'unavailable').slice(0, 160)}`, helv, 9)
  gap(10)
  drawWrapped(
    'The signer typed their name and affirmatively confirmed their intent to sign the documents listed above electronically. Copies of this signed record were emailed to the signer and the host agent at the time of signing. ohACCESS retains no copy of this document; the SHA-256 hashes above allow any kept copy of the original documents to be verified against this certificate.',
    helv, 8.5, gray, 3
  )

  return out.save()
}

// The 14 standard PDF fonts only cover WinAnsi. Names and addresses can carry
// characters outside it (accents mostly survive; CJK does not). Replace
// anything unencodable with '?' — an imperfect glyph is acceptable, a thrown
// signature ceremony is not. The receipt row keeps the exact typed string.
function sanitizeForFont(text: string, font: PDFFont): string {
  let outStr = ''
  for (const ch of text) {
    try {
      font.encodeText(ch)
      outStr += ch
    } catch {
      outStr += '?'
    }
  }
  return outStr
}

// "July 29, 2026, 1:14 PM CDT" in the property's timezone — the wall-clock
// time everyone at the open house experienced. Falls back to UTC ISO if the
// stored timezone string is invalid.
function formatSignedAt(iso: string, timezone: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  try {
    return d.toLocaleString('en-US', {
      timeZone: timezone || 'UTC',
      dateStyle: 'long',
      timeStyle: 'short',
    }) + (timezone ? ` (${timezone})` : ' (UTC)')
  } catch {
    return d.toISOString()
  }
}
