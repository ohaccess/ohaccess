// The one and only site footer. Every public page renders this — do NOT
// hand-roll another footer. Before 2026-07-26 there were eleven separate
// copies that had drifted apart (same /terms page labeled both "Visitor
// Terms" and "Terms of Service", Contact pointing at a mailto: on the legal
// pages, Blog/Gift/Resources missing from most). Design is "The Record"
// footer bar from the homepage; the link list is the full public set.
//
// Self-contained on purpose: inline styles plus a scoped hover rule, so it
// looks identical on pages that don't load TheRecord's `rec-*` CSS.

const LINKS = [
  { href: '/faq', label: 'FAQ' },
  { href: '/blog', label: 'Blog' },
  { href: '/resources', label: 'Resources' },
  { href: '/planner', label: 'Game-Day Planner' },
  { href: '/partners', label: 'Partners' },
  { href: '/gift', label: 'Gift' },
  { href: '/contact', label: 'Contact' },
  { href: '/terms', label: 'Visitor Terms' },
  { href: '/subscriber-terms', label: 'Subscriber Terms' },
  { href: '/privacy', label: 'Privacy Policy' },
]

// Social channels, shown as icons beside the copyright line. Paths are the
// brands' own glyphs, redrawn as single 24x24 outlines so they sit at one
// weight next to each other and pick up the link colour (fill: currentColor).
const SOCIAL = [
  {
    href: 'https://www.facebook.com/ohaccess',
    label: 'ohACCESS on Facebook',
    path: 'M13.5 22v-8.2h2.8l.4-3.3h-3.2V8.4c0-.9.3-1.6 1.6-1.6h1.7V3.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.3h2.8V22h3.4Z',
  },
  {
    href: 'https://www.instagram.com/ohaccess',
    label: 'ohACCESS on Instagram',
    path: 'M12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Zm0 7.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm5.9-7.8a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM12 2.2c-2.7 0-3 0-4 .1-1.1 0-1.8.2-2.4.4-.7.3-1.2.6-1.8 1.2S2.9 5 2.7 5.6c-.3.6-.4 1.3-.5 2.4v8c.1 1.1.2 1.8.5 2.4.2.7.6 1.2 1.1 1.8.6.6 1.1.9 1.8 1.2.6.2 1.3.4 2.4.4 1 .1 1.3.1 4 .1s3 0 4-.1c1.1 0 1.8-.2 2.4-.4.7-.3 1.2-.6 1.8-1.2s.9-1.1 1.2-1.8c.2-.6.4-1.3.4-2.4.1-1 .1-1.3.1-4s0-3-.1-4c0-1.1-.2-1.8-.4-2.4-.3-.7-.6-1.2-1.2-1.8S19 2.9 18.4 2.7c-.6-.3-1.3-.4-2.4-.5-1 0-1.3 0-4 0Zm0 1.6c2.6 0 2.9 0 4 .1 1 0 1.5.2 1.8.3.5.2.8.4 1.2.8.4.4.6.7.8 1.2.1.3.3.8.3 1.8.1 1.1.1 1.4.1 4s0 2.9-.1 4c0 1-.2 1.5-.3 1.8-.2.5-.4.8-.8 1.2-.4.4-.7.6-1.2.8-.3.1-.8.3-1.8.3-1.1.1-1.4.1-4 .1s-2.9 0-4-.1c-1 0-1.5-.2-1.8-.3-.5-.2-.8-.4-1.2-.8-.4-.4-.6-.7-.8-1.2-.1-.3-.3-.8-.3-1.8-.1-1.1-.1-1.4-.1-4s0-2.9.1-4c0-1 .2-1.5.3-1.8.2-.5.4-.8.8-1.2.4-.4.7-.6 1.2-.8.3-.1.8-.3 1.8-.3 1.1-.1 1.4-.1 4-.1Z',
  },
  {
    href: 'https://www.youtube.com/@ohACCESS',
    label: 'ohACCESS on YouTube',
    path: 'M23 7.2s-.2-1.6-.9-2.3c-.9-.9-1.8-.9-2.3-1C16.6 3.7 12 3.7 12 3.7s-4.6 0-7.8.2c-.5.1-1.4.1-2.3 1C1.2 5.6 1 7.2 1 7.2S.8 9.1.8 11v1.8c0 1.9.2 3.8.2 3.8s.2 1.6.9 2.3c.9.9 2 .9 2.5 1 1.8.2 7.6.2 7.6.2s4.6 0 7.8-.2c.5-.1 1.4-.1 2.3-1 .7-.7.9-2.3.9-2.3s.2-1.9.2-3.8V11c0-1.9-.2-3.8-.2-3.8ZM9.7 14.9V8.3l6 3.3-6 3.3Z',
  },
]

// marginTop: standalone pages want breathing room above the dark bar; the
// homepage tucks the footer flush inside the page container and passes '0'.
export default function Footer({ marginTop = '60px' }: { marginTop?: string }) {
  return (
    <footer
      style={{
        background: '#1d1d1f',
        padding: '30px clamp(20px,5vw,48px)',
        marginTop,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
      }}
    >
      <style>{'.oha-foot-link{color:inherit;text-decoration:none;transition:color .2s}.oha-foot-link:hover{color:#c9963a}'}</style>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>
        Powered by oh<span style={{ color: '#c9963a' }}>ACCESS</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', columnGap: '24px', rowGap: '10px', fontSize: '12.5px', color: 'rgba(255,255,255,.5)' }}>
        {LINKS.map(l => (
          <a key={l.href} href={l.href} className="oha-foot-link">{l.label}</a>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '14px', fontSize: '12.5px', color: 'rgba(255,255,255,.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {SOCIAL.map(s => (
            <a
              key={s.href}
              href={s.href}
              className="oha-foot-link"
              aria-label={s.label}
              title={s.label}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', lineHeight: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d={s.path} />
              </svg>
            </a>
          ))}
        </div>
        <div>© 2026 <strong>ohACCESS</strong> · Patent Pending</div>
      </div>
    </footer>
  )
}
