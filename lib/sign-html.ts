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
// Two looks, toggled on the page itself (screen-only control, like the
// heading cycler): full color (default) floods the page with the primary
// color, white-card logo and QR, accent banner; ink saver is the white-
// background original.
export function buildSignHtml(opts: { dataUrl: string; logoUrl: string; primaryColor: string; onPrimary: string; accentColor: string; onAccent?: string }): string {
  const primary = safe(opts.primaryColor) || '#1d1d1f'
  const onPrimary = safe(opts.onPrimary) || '#ffffff'
  const accent = safe(opts.accentColor) || '#1d1d1f'
  const onAccent = safe(opts.onAccent || '') || '#ffffff'
  const logoUrl = /^https?:\/\//i.test(opts.logoUrl || '') ? safe(opts.logoUrl) : ''
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>ohACCESS Sign</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { margin: 0.4in; }
  /* Backgrounds must survive the print dialog — without this, browsers strip
     them and the full-color sign prints as the white one. */
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background: white; color: #1d1d1f; display: flex; justify-content: center; }
  .sign { width: 100%; max-width: 7.7in; text-align: center; padding: 3px 6px; }
  /* Fixed-height brand area so a tall agent logo can't push the sign onto a
     second page — every logo (and the wordmark fallback) occupies exactly
     this space, centered. */
  .brandhead { height: 90px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .logo { max-height: 90px; max-width: 64%; object-fit: contain; }
  .wordmark { font-size: 50px; font-weight: 400; letter-spacing: -1px; }
  .wordmark b { font-weight: 800; }
  .tagline { font-size: 14px; font-weight: 600; letter-spacing: 5px; margin-top: 6px; }
  .rule { border: none; border-top: 3px solid ${accent}; margin: 7px 0; }
  .banner { background: ${primary}; color: ${onPrimary}; font-size: 27px; font-weight: 800; letter-spacing: 8px; padding: 10px 10px; margin-bottom: 8px; cursor: pointer; }
  .banner-hint { font-size: 12px; color: #8e8e93; margin: -4px 0 6px; }
  /* Screen-only print button — the page no longer auto-opens the print
     dialog, so this is how the sign gets printed. */
  .print-btn { position: fixed; top: 14px; right: 14px; background: #1d1d1f; color: #ffffff; border: none; border-radius: 10px; padding: 11px 20px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,0.35); }
  @media print { .banner-hint, .print-btn { display: none; } }
  .lead { font-size: 23.5px; font-weight: 700; line-height: 1.42; margin: 0 auto 6px; max-width: 100%; }
  .body { font-size: 21px; font-weight: 400; line-height: 1.48; color: #3a3a3c; margin: 0 auto 8px; max-width: 100%; }
  .qr { display: inline-block; border: 4px solid ${accent}; border-radius: 12px; padding: 12px; }
  .qr img { width: 285px; height: 285px; display: block; }
  .lang-label { font-size: 14px; font-weight: 700; letter-spacing: 4px; color: #8e8e93; margin: 9px 0 6px; }
  .lead-es { font-size: 20px; font-weight: 700; line-height: 1.42; margin: 0 auto 6px; max-width: 100%; }
  .body-es { font-size: 17.5px; font-weight: 400; line-height: 1.48; color: #3a3a3c; margin: 0 auto 7px; max-width: 100%; }
  .footer-powered { font-size: 14px; color: #6e6e73; margin-bottom: 3px; }
  .footer-brand { font-size: 27px; font-weight: 800; }
  .footer-tag { font-size: 13px; font-weight: 600; letter-spacing: 4px; color: #6e6e73; margin-top: 3px; }
  /* Full-color look (default): primary floods the page, logo and QR sit on
     white cards so any logo and every scanner still work, banner goes accent.
     Same element heights as ink saver, so neither look risks a second page. */
  body.fullcolor { background: ${primary}; color: ${onPrimary}; }
  .fullcolor .brandhead { background: #ffffff; border-radius: 14px; padding: 8px 22px; color: #1d1d1f; }
  .fullcolor .logo { max-height: 74px; }
  .fullcolor .banner { background: ${accent}; color: ${onAccent}; }
  .fullcolor .banner-hint { color: ${onPrimary}; opacity: 0.75; }
  .fullcolor .body, .fullcolor .body-es { color: ${onPrimary}; opacity: 0.92; }
  .fullcolor .qr { background: #ffffff; }
  .fullcolor .lang-label { color: ${onPrimary}; opacity: 0.75; }
  .fullcolor .footer-powered, .fullcolor .footer-tag { color: ${onPrimary}; opacity: 0.8; }
</style>
</head>
<body class="fullcolor">
  <button class="print-btn" id="printBtn" type="button">🖨 Print</button>
  <div class="sign">
    <div class="brandhead">${logoUrl
      ? `<img class="logo" src="${logoUrl}" alt="Logo" onerror="this.style.display='none';document.getElementById('wm').style.display='block'"><div class="wordmark" id="wm" style="display:none">oh<b>ACCESS</b></div>`
      : `<div class="wordmark">oh<b>ACCESS</b></div><div class="tagline">VERIFIED OPEN HOUSE CHECK-IN</div>`}</div>
    <hr class="rule">
    <div class="banner" id="banner">YOUR ATTENTION PLEASE</div>
    <div class="banner-hint">Click the banner to switch headings, then press Print. These tips and the Print button won't print.</div>
    <div class="banner-hint" id="modeToggle" style="cursor: pointer; text-decoration: underline;">Switch to the ink-saver version (white background)</div>
    <div class="lead">For the safety of the host, the property, and other guests, the owner of this property is requiring that <em>all</em> visitors scan the QR-code and complete the form <em>before</em> entering.</div>
    <div class="body">A valid phone number &amp; email are <strong>required</strong> in order to receive the unique codeword. Share the codeword with the host to tour the property.</div>
    <div class="qr"><img src="${opts.dataUrl}" alt="QR Code"></div>
    <div class="lang-label">— ESPAÑOL —</div>
    <div class="lead-es">Por la seguridad del anfitrión, la propiedad y los demás visitantes, el propietario de esta vivienda exige que <em>todos</em> los visitantes escaneen el código QR y completen el formulario <em>antes</em> de entrar.</div>
    <div class="body-es">Se <strong>requieren</strong> un número de teléfono y un correo electrónico válidos para recibir la palabra clave. Comparta la palabra clave con el anfitrión para recorrer la propiedad.</div>
    <hr class="rule">
    <div class="footer-powered">Powered by</div>
    <div class="footer-brand">ohACCESS.com</div>
    <div class="footer-tag">VERIFIED OPEN HOUSE CHECK-IN</div>
  </div>
  <script>
    document.getElementById('printBtn').addEventListener('click', function () { window.print() })
    // Clicking the banner cycles through alternate headings; the agent then
    // reprints with the Print button.
    ;(function () {
      var headings = ['YOUR ATTENTION PLEASE', 'WELCOME! PLEASE READ.', 'REQUIRED BEFORE ENTRY', 'CODEWORD REQUIRED', 'SAFETY PROTOCOL']
      var i = 0
      document.getElementById('banner').addEventListener('click', function () {
        i = (i + 1) % headings.length
        this.textContent = headings[i]
      })
    })()
    // Clicking the hint swaps between the full-color and ink-saver looks.
    document.getElementById('modeToggle').addEventListener('click', function () {
      var full = document.body.classList.toggle('fullcolor')
      this.textContent = full
        ? 'Switch to the ink-saver version (white background)'
        : 'Switch to the full-color version'
    })
  </script>
</body>
</html>`
}
