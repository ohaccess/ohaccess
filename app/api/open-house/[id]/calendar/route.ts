import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

// Compact UTC stamp for iCalendar: 2026-05-31T18:00:00.000Z -> 20260531T180000Z
function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}
// Escape per RFC 5545 text rules.
function icsEscape(s: string): string {
  return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

// GET: a downloadable .ics file for one open house (Apple Calendar, Outlook
// desktop, Google import). Service-role read of safe fields only.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: oh } = await supabase
    .from('open_houses')
    .select('id, property_address, start_at, end_at')
    .eq('id', id)
    .maybeSingle()

  if (!oh || !oh.start_at || !oh.end_at) {
    return NextResponse.json({ error: 'Open house has no scheduled time' }, { status: 404 })
  }

  const title = `Open House — ${oh.property_address || ''}`.trim()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ohACCESS//Open House//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${oh.id}@ohaccess.com`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(oh.start_at)}`,
    `DTEND:${icsStamp(oh.end_at)}`,
    `SUMMARY:${icsEscape(title)}`,
    `LOCATION:${icsEscape(oh.property_address || '')}`,
    'DESCRIPTION:Open house hosted via ohACCESS.',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return new NextResponse(lines.join('\r\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="open-house-${oh.id}.ics"`,
    },
  })
}
