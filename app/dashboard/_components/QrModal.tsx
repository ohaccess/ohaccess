'use client'

// The QR-code modal shown when an agent clicks "QR" on one of their open
// houses: preview, download/copy/share the registration link, and add-to-
// calendar links. Extracted verbatim from the dashboard page; branding colors
// and showToast are passed in so it stays presentational.

export type QrModalData = { oh: any; url: string; dataUrl: string; blob: Blob }

// Strip characters that could break out of an HTML attribute/CSS value when
// branding values are interpolated into the printable-sign document.
const safe = (v: string) => String(v || '').replace(/[<>"'`]/g, '')

// Print-ready open-house sign (portrait letter): agent logo up top, branded
// "PLEASE READ" banner, the QR code, and the ohACCESS footer. Same sign works
// for a per-open-house QR and the permanent agent QR — no address on it.
export function buildSignHtml(opts: { dataUrl: string; logoUrl: string; primaryColor: string; onPrimary: string; accentColor: string }): string {
  const primary = safe(opts.primaryColor) || '#1d1d1f'
  const onPrimary = safe(opts.onPrimary) || '#ffffff'
  const accent = safe(opts.accentColor) || '#1d1d1f'
  const logoUrl = /^https?:\/\//i.test(opts.logoUrl || '') ? safe(opts.logoUrl) : ''
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>ohACCESS Sign</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { margin: 0.4in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background: white; color: #1d1d1f; display: flex; justify-content: center; }
  .sign { width: 100%; max-width: 7.5in; text-align: center; padding: 6px 10px; }
  .logo { max-height: 90px; max-width: 65%; object-fit: contain; }
  .wordmark { font-size: 48px; font-weight: 400; letter-spacing: -1px; }
  .wordmark b { font-weight: 800; }
  .tagline { font-size: 14px; font-weight: 600; letter-spacing: 5px; margin-top: 6px; }
  .rule { border: none; border-top: 3px solid ${accent}; margin: 14px 0; }
  .banner { background: ${primary}; color: ${onPrimary}; font-size: 26px; font-weight: 800; letter-spacing: 8px; padding: 12px 10px; margin-bottom: 18px; }
  .lead { font-size: 24px; font-weight: 700; line-height: 1.45; margin: 0 auto 16px; max-width: 94%; }
  .body { font-size: 22px; font-weight: 400; line-height: 1.5; color: #3a3a3c; margin: 0 auto 18px; max-width: 94%; }
  .qr { display: inline-block; border: 4px solid ${accent}; border-radius: 12px; padding: 12px; }
  .qr img { width: 280px; height: 280px; display: block; }
  .footer-powered { font-size: 14px; color: #6e6e73; margin-bottom: 4px; }
  .footer-brand { font-size: 26px; font-weight: 800; }
  .footer-tag { font-size: 12px; font-weight: 600; letter-spacing: 4px; color: #6e6e73; margin-top: 4px; }
</style>
</head>
<body>
  <div class="sign">
    ${logoUrl
      ? `<img class="logo" src="${logoUrl}" alt="Logo" onerror="this.style.display='none';document.getElementById('wm').style.display='block'"><div class="wordmark" id="wm" style="display:none">oh<b>ACCESS</b></div>`
      : `<div class="wordmark">oh<b>ACCESS</b></div><div class="tagline">VERIFIED VISITOR CHECK-IN</div>`}
    <hr class="rule">
    <div class="banner">PLEASE READ</div>
    <div class="lead">For the safety of the host, the seller, and the property, all visitors must scan the QR-code and complete the registration form before entering.</div>
    <div class="body">A unique code word to enter this Open House is immediately sent via SMS and Email. Share the code word with the host to gain access.</div>
    <div class="qr"><img src="${opts.dataUrl}" alt="QR Code"></div>
    <hr class="rule">
    <div class="footer-powered">Powered by</div>
    <div class="footer-brand">ohACCESS.com</div>
    <div class="footer-tag">VERIFIED VISITOR CHECK-IN</div>
  </div>
  <script>window.onload = function () { setTimeout(function () { window.print() }, 500) }</script>
</body>
</html>`
}

export default function QrModal({
  data,
  onClose,
  showToast,
  primaryColor,
  onPrimary,
  primaryBtnBorder,
  accentColor,
  onAccent,
  accentBtnBorder,
  logoUrl,
}: {
  data: QrModalData
  onClose: () => void
  showToast: (message: string, type?: 'success' | 'error') => void
  primaryColor: string
  onPrimary: string
  primaryBtnBorder: string
  accentColor: string
  onAccent: string
  accentBtnBorder: string
  logoUrl?: string
}) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}
      onClick={onClose}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '28px', maxWidth: '380px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#1d1d1f', marginBottom: '3px' }}>
            {data.oh.street_address || data.oh.property_address}
          </div>
          <div style={{ fontSize: '13px', color: '#6e6e73' }}>
            {data.oh.open_house_date}{data.oh.open_house_hours ? ` · ${data.oh.open_house_hours}` : ''}
          </div>
        </div>

        {/* QR Code */}
        <div style={{ background: '#f5f5f7', borderRadius: '16px', padding: '20px', marginBottom: '20px', display: 'inline-block' }}>
          <img src={data.dataUrl} alt="QR Code" style={{ width: '200px', height: '200px', display: 'block' }} />
        </div>

        <div style={{ fontSize: '12px', color: '#6e6e73', marginBottom: '20px' }}>
          Visitors scan this code to register and receive their access code
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => {
            const a = document.createElement('a')
            a.href = data.dataUrl
            a.download = `ohaccess-qr-${data.oh.property_address.replace(/\s+/g, '-')}.png`
            a.click()
          }} style={{ background: primaryColor, color: onPrimary, border: primaryBtnBorder, borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            📥 Download PNG
          </button>

          <button onClick={() => {
            const w = window.open('', '_blank')
            if (!w) { showToast('Please allow pop-ups to print the sign.', 'error'); return }
            w.document.write(buildSignHtml({ dataUrl: data.dataUrl, logoUrl: logoUrl || '', primaryColor, onPrimary, accentColor }))
            w.document.close()
          }} style={{ background: accentColor, color: onAccent, border: accentBtnBorder, borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            🖨 Print branded sign
          </button>

          <button onClick={() => {
            navigator.clipboard.writeText(data.url)
            showToast('Registration URL copied!')
          }} style={{ background: '#f5f5f7', color: '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            📋 Copy registration URL
          </button>

          {navigator.share && (
            <button onClick={async () => {
              try {
                const file = new File([data.blob], `ohaccess-qr.png`, { type: 'image/png' })
                await navigator.share({
                  title: `ohACCESS QR — ${data.oh.street_address || data.oh.property_address}`,
                  text: `Scan to register for the open house at ${data.oh.property_address}`,
                  files: [file]
                })
              } catch (err) {
                console.log('Share cancelled')
              }
            }} style={{ background: accentColor, color: onAccent, border: accentBtnBorder, borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              📤 Share QR Code
            </button>
          )}

          {/* Add to calendar — only when the open house has a scheduled time */}
          {data.oh.start_at && data.oh.end_at && (() => {
            const z = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
            const tz = data.oh.timezone
            // Compact wall-clock stamp (YYYYMMDDTHHMMSS) in the property's tz.
            const localStamp = (iso: string) => {
              const dtf = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
              const p: Record<string, string> = {}
              for (const part of dtf.formatToParts(new Date(iso))) p[part.type] = part.value
              return `${p.year}${p.month}${p.day}T${p.hour}${p.minute}${p.second}`
            }
            const title = encodeURIComponent(`Open House — ${data.oh.property_address || ''}`)
            const loc = encodeURIComponent(data.oh.property_address || '')
            // Anchor the event to the PROPERTY's timezone (ctz) so it reads at
            // the scheduled local time no matter where it's added from.
            const gcal = tz
              ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${localStamp(data.oh.start_at)}/${localStamp(data.oh.end_at)}&ctz=${encodeURIComponent(tz)}&location=${loc}`
              : `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${z(data.oh.start_at)}/${z(data.oh.end_at)}&location=${loc}`
            const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${encodeURIComponent(data.oh.start_at)}&enddt=${encodeURIComponent(data.oh.end_at)}&location=${loc}&path=/calendar/action/compose&rru=addevent`
            const ics = `/api/open-house/${data.oh.id}/calendar`
            const calBtn = { flex: 1, textAlign: 'center' as const, background: '#f5f5f7', color: '#1d1d1f', border: '1px solid #d1d1d6', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif" }
            return (
              <div style={{ borderTop: '1px solid #f2f2f7', paddingTop: '12px', marginTop: '2px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6e6e73', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>📅 Add to calendar</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a href={gcal} target="_blank" rel="noopener noreferrer" style={calBtn}>Google</a>
                  <a href={outlook} target="_blank" rel="noopener noreferrer" style={calBtn}>Outlook</a>
                  <a href={ics} style={calBtn}>Apple / .ics</a>
                </div>
              </div>
            )
          })()}

          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aeaeb2', fontSize: '13px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '4px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
