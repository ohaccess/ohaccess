// Compress a raw browser user-agent string into a short human label
// ("iPhone · Safari", "Android · Chrome") for the admin scan log — the raw
// string is 100+ chars of noise that truncates everything after it.

export function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device'
  const s = ua.toLowerCase()

  if (/bot|crawler|spider|curl|wget|python|httpclient|facebookexternalhit/.test(s)) return 'Bot'

  let device = 'Unknown device'
  if (s.includes('iphone')) device = 'iPhone'
  else if (s.includes('ipad')) device = 'iPad'
  else if (s.includes('android')) device = 'Android'
  else if (s.includes('macintosh') || s.includes('mac os')) device = 'Mac'
  else if (s.includes('windows')) device = 'Windows'
  else if (s.includes('linux')) device = 'Linux'

  let browser = ''
  // Order matters: Edge/Chrome UAs also contain "safari".
  if (s.includes('edg/')) browser = 'Edge'
  else if (s.includes('samsungbrowser')) browser = 'Samsung Browser'
  else if (s.includes('firefox')) browser = 'Firefox'
  else if (s.includes('crios') || s.includes('chrome')) browser = 'Chrome'
  else if (s.includes('safari')) browser = 'Safari'

  return browser ? `${device} · ${browser}` : device
}
