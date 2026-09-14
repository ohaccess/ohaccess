// Visitor sign-in times in the PROPERTY's timezone (open_houses.timezone), so
// the visitor log and CSV exports match the open house card's hours and the
// agent's SMS alert, wherever the person viewing the dashboard happens to be.
// A missing or unrecognised timezone falls back to the viewer's own.

const STYLES: Record<'log' | 'csv', Intl.DateTimeFormatOptions> = {
  // Visitor log table: "Sep 13, 1:30 PM"
  log: { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  // CSV "Registered" column: "9/13/2026, 1:30 PM"
  csv: { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' },
}

export function formatPropertyTime(
  iso: string | null | undefined,
  timeZone: string | null | undefined,
  style: 'log' | 'csv' = 'log'
): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''
  if (timeZone) {
    try {
      return date.toLocaleString('en-US', { ...STYLES[style], timeZone })
    } catch {
      // Unknown timezone id: fall through to the viewer's own.
    }
  }
  return date.toLocaleString('en-US', STYLES[style])
}
