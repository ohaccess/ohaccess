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
  { href: '/partners', label: 'Partners' },
  { href: '/gift', label: 'Gift' },
  { href: '/contact', label: 'Contact' },
  { href: '/terms', label: 'Visitor Terms' },
  { href: '/subscriber-terms', label: 'Subscriber Terms' },
  { href: '/privacy', label: 'Privacy Policy' },
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
      <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,.5)' }}>© 2026 <strong>ohACCESS</strong> · Patent Pending</div>
    </footer>
  )
}
