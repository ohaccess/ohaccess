import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { randomUUID, createHash } from 'crypto'
import { PDFDocument } from 'pdf-lib'
import { getAuthenticatedUser } from '@/lib/auth'
import {
  normalizeAgreementTemplates,
  looksLikePdf,
  MAX_AGREEMENT_TEMPLATES,
  MAX_AGREEMENT_TEMPLATE_BYTES,
  MAX_AGREEMENT_TEMPLATE_PAGES,
  MAX_AGREEMENT_LABEL_LENGTH,
} from '@/lib/agreements'

export const runtime = 'nodejs'

// Upload / delete an agent's BLANK agreement templates (migration 043). This
// is the first real file-upload path in the app: files go to the private
// 'agreement-templates' bucket via the service role after the permission
// check here — the bucket has no object-level policies (006 convention).
//
// Storing the blank form is settings, not a signed record — the send-and-
// forget rule applies to SIGNED documents, which never touch storage at all.

// POST multipart/form-data: file=<pdf>, label=<name shown to visitors>
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid upload' }, { status: 400 })
    }

    const file = form.get('file')
    const label = String(form.get('label') || '').trim().slice(0, MAX_AGREEMENT_LABEL_LENGTH)
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (!label) {
      return NextResponse.json({ error: 'Give the document a name visitors will see' }, { status: 400 })
    }
    if (file.size > MAX_AGREEMENT_TEMPLATE_BYTES) {
      return NextResponse.json({ error: 'PDF must be 2 MB or smaller' }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    // Trust the bytes, not the client's content type.
    if (!looksLikePdf(bytes)) {
      return NextResponse.json({ error: 'That file is not a PDF' }, { status: 400 })
    }

    // Parse now, at upload time, so a corrupt or password-protected file is
    // rejected here — never mid-signature with a visitor waiting at the door.
    let pageCount = 0
    try {
      const doc = await PDFDocument.load(bytes)
      pageCount = doc.getPageCount()
    } catch {
      return NextResponse.json(
        { error: 'Could not read that PDF. If it is password-protected, remove the password and re-upload.' },
        { status: 400 }
      )
    }
    if (pageCount < 1 || pageCount > MAX_AGREEMENT_TEMPLATE_PAGES) {
      return NextResponse.json(
        { error: `Keep it short — up to ${MAX_AGREEMENT_TEMPLATE_PAGES} pages (this one has ${pageCount}). Visitors sign on their phones at the door.` },
        { status: 400 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('agreement_templates')
      .eq('id', user.id)
      .maybeSingle()
    const existing = normalizeAgreementTemplates(profile?.agreement_templates)
    if (existing.length >= MAX_AGREEMENT_TEMPLATES) {
      return NextResponse.json(
        { error: `You can store up to ${MAX_AGREEMENT_TEMPLATES} documents. Delete one first.` },
        { status: 400 }
      )
    }

    const id = randomUUID()
    const path = `${user.id}/${id}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('agreement-templates')
      .upload(path, bytes, { contentType: 'application/pdf' })
    if (uploadErr) {
      console.error('Agreement template upload failed:', uploadErr)
      return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
    }

    const template = {
      id,
      label,
      path,
      size: bytes.length,
      pages: pageCount,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      uploaded_at: new Date().toISOString(),
    }

    const { error: saveErr } = await supabase
      .from('profiles')
      .update({ agreement_templates: [...existing, template] })
      .eq('id', user.id)
    if (saveErr) {
      // Don't leave an orphaned object the agent can't see or delete.
      await supabase.storage.from('agreement-templates').remove([path])
      console.error('Agreement template save failed:', saveErr)
      return NextResponse.json({ error: 'Could not save the document. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, template })
  } catch (err) {
    console.error('Agreement template upload error:', err)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }
}

// DELETE { id }: remove one template. Open houses that still reference the id
// fail open by design — the resolver drops stale ids, and if none remain the
// agreement step is skipped rather than blocking a sign-in (lib/agreements).
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('agreement_templates')
      .eq('id', user.id)
      .maybeSingle()
    const existing = normalizeAgreementTemplates(profile?.agreement_templates)
    const target = existing.find(t => t.id === id)
    if (!target) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const remaining = existing.filter(t => t.id !== id)
    const { error: saveErr } = await supabase
      .from('profiles')
      .update({ agreement_templates: remaining.length > 0 ? remaining : null })
      .eq('id', user.id)
    if (saveErr) {
      console.error('Agreement template delete failed:', saveErr)
      return NextResponse.json({ error: 'Could not delete the document. Please try again.' }, { status: 500 })
    }

    // Remove the file second: if this fails the object is orphaned (harmless,
    // unreachable) rather than the profile pointing at a missing file.
    const { error: removeErr } = await supabase.storage.from('agreement-templates').remove([target.path])
    if (removeErr) console.error('Agreement template file removal failed:', removeErr)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Agreement template delete error:', err)
    return NextResponse.json({ error: 'Could not delete the document. Please try again.' }, { status: 500 })
  }
}
