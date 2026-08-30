// Contrast helpers for the agent-chosen brand colors (primary / accent).
// Agents can pick any hex, including white or near-white, which would
// otherwise make white button labels or accent-colored text disappear.
// These keep text and buttons readable regardless of the chosen color.

// Perceived luminance on a 0–255 scale, or null if the hex can't be
// parsed. Weights match the standard sRGB brightness formula.
function luminance(hex: string): number | null {
  const c = (hex || '').replace('#', '')
  const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c
  if (full.length !== 6) return null
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return null
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// True when the color is light enough that white text on top of it would
// be hard to read. ~186 is the usual crossover for white-vs-black text.
export function isLightColor(hex: string): boolean {
  const l = luminance(hex)
  return l !== null && l > 186
}

// Readable text/icon color to place ON a filled swatch of `hex` (e.g. a
// button background): dark text on light fills, white on dark fills.
export function onColor(hex: string): string {
  return isLightColor(hex) ? '#1d1d1f' : '#ffffff'
}

// A version of `hex` safe to use AS text, a thin border, or a small
// figure on the light app background (#f5f5f7 / white). If the chosen
// color is too light to read, fall back to near-black.
export function readableOnLight(hex: string): string {
  return isLightColor(hex) ? '#1d1d1f' : hex
}

// A hairline border that gives a filled button/swatch a visible edge
// when its fill is so light it would vanish against the page. Empty
// string when the fill is dark enough to stand on its own.
export function fillBorder(hex: string): string {
  return isLightColor(hex) ? '1px solid rgba(0,0,0,0.15)' : 'none'
}

// Normalized form for comparing two hex colors ("#ABC" matches "#aabbcc").
function normalizeHex(hex: string): string {
  const c = (hex || '').replace('#', '').toLowerCase()
  return c.length === 3 ? c.split('').map(x => x + x).join('') : c
}

// Color for initials/figures drawn ON a primary-color fill (the fallback
// avatar circle): the accent color — unless the agent picked the same color
// for both, where the initials would vanish; then white or black, whichever
// reads against the primary.
export function accentOnPrimary(primary: string, accent: string): string {
  return normalizeHex(primary) === normalizeHex(accent) ? onColor(primary) : accent
}
