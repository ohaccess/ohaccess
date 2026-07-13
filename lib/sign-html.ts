// Print-ready branded open-house sign, shared by the dashboard QR modal
// (client-side window.open + document.write) and /api/sign (server-rendered
// from an email link). Pure string builder — keep free of side-effecting
// imports so both sides can use it.

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
