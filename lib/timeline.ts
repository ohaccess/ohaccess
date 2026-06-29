// Single source of truth for visitor purchasing-timeline buckets. The
// registration form (app/register/[id]/page.tsx) writes one of TIMELINE_ORDER
// to visitors.purchasing_timeline; everything that colors, ranks, or groups
// timelines reads from here so the labels can't drift apart again. (They did
// once: the form was simplified from 5 buckets to 4, but four separate color
// and order maps kept the old labels — so two buckets fell back to grey and
// two shared a color, and the post-event report filed the hottest leads under
// "Other".)

export interface TimelineStyle { bg: string; color: string }

// The buckets the form offers, soonest → latest. Order drives the sort rank
// and the post-event report grouping.
export const TIMELINE_ORDER = ['0–3 Months', '3–6 Months', '6–12 Months', '12+ Months']

const NEUTRAL: TimelineStyle = { bg: '#f2f2f7', color: '#555555' }

// Hot → cold: a nearer-term buyer is the warmer lead. One distinct stop per
// bucket, drawn from the existing badge palette.
const STYLES: Record<string, TimelineStyle> = {
  '0–3 Months':  { bg: '#fff0e6', color: '#b84800' }, // orange — hottest
  '3–6 Months':  { bg: '#fff9e0', color: '#8a6400' }, // amber
  '6–12 Months': { bg: '#e5f0ff', color: '#0040a0' }, // blue
  '12+ Months':  { bg: '#f2f2f7', color: '#555555' }, // grey — coldest
  // Legacy labels from before the form was simplified to 4 buckets. Only
  // pre-launch test rows use these; kept so they still show a sensible color.
  '0–1 Month':   { bg: '#fff0e6', color: '#b84800' },
  '2–3 Months':  { bg: '#fff9e0', color: '#8a6400' },
}

// Badge colors for a timeline value; neutral grey for anything unrecognized.
export function timelineStyle(timeline: string | null | undefined): TimelineStyle {
  return (timeline ? STYLES[timeline] : undefined) ?? NEUTRAL
}

// Sort key, soonest first; unknown / unspecified values sort last.
export function timelineRank(timeline: string | null | undefined): number {
  const i = timeline ? TIMELINE_ORDER.indexOf(timeline) : -1
  return i === -1 ? 99 : i
}
