'use client'
// "The Record" — parallel landing page from the Claude Design handoff
// (design-drop/). The prototype's inline styles and script are the spec;
// this is a faithful port to React. The #film section ships with a poster
// placeholder + play button until the 90-second film is delivered.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const STEPS = [
  { n: 1, title: 'Scan', body: 'The visitor scans the QR sign at the door. No app to download, nothing to install.' },
  { n: 2, title: 'Register', body: 'A 30-second form: name, phone, email, and buying timeline.' },
  { n: 3, title: 'Code word', body: <>A one-time code word lands by text <em>and</em> email — instantly. Fake contact info receives nothing.</> },
  { n: 4, title: 'Verified entry', body: 'They share the code word with you to come in. Real contact, real person, on the record.' },
  { n: 5, title: 'Leads land', body: 'Live log, instant alerts, CRM sync, and a post-event report — automatic.' },
]

const SCENES = [
  { time: '0:00–0:08', title: 'The sign goes up.', body: 'Sunday morning. An agent sets the Open House sign and QR placard at a sunlit front door.', vo: '“Every Open House starts the same way — a sign in the yard, and strangers at the door.”' },
  { time: '0:08–0:16', title: 'The old record.', body: 'Close-up of a paper sign-in sheet: scribbles, a fake “M. Mouse,” a number with nine digits.', vo: '“For decades, the record of who walked in looked like this. Fake names. Dead numbers. Ink you can’t read.”' },
  { time: '0:16–0:30', title: 'Thirty seconds at the door.', body: 'A couple arrives. She scans the QR sign; a clean mobile form fills in thirty seconds.', vo: <>“<strong>ohACCESS</strong> changes that in thirty seconds. Visitors scan and register at the door…”</> },
  { time: '0:30–0:42', title: 'The code word.', body: 'Her phone buzzes: “Your code word is MAGNOLIA.” A backup code word lands in her email.', vo: '“…and receive a one-time code word — sent to the provided phone and email. Fake info? No code. No entry.”' },
  { time: '0:42–0:56', title: '“Magnolia.”', body: 'She says the word at the door. The agent’s phone has already shown her name and 0–3 month timeline.', vo: '“The agent knows who’s walking in before they say ‘Hello’ — verified and logged.”' },
  { time: '0:56–1:10', title: 'Doors close, work’s done.', body: 'That evening: the dashboard’s visitor log; leads appearing inside a CRM, one by one.', vo: '“When the doors close, the work is already done — every lead verified and delivered to your CRM.”' },
  { time: '1:10–1:25', title: 'Proof for the seller.', body: 'The agent texts the seller a report card: 14 verified visitors, 5 buying within 3 months.', vo: <>“And the seller gets proof it was worth opening their door. <strong>ohACCESS</strong>. The verified Open House.”</>, dark: true },
]

const LOG_ROWS = [
  { order: 0, final: 1, name: 'Marcus Lee', meta: '(415) 555-0290 · verified 2:19 PM', tag: 'BUYING 0–3 MO', tagBg: '#eafaf0', tagColor: '#1d8f45' },
  { order: 1, final: 3, name: 'Dana Kowalski', meta: '(510) 555-0311 · verified 2:26 PM', tag: '12+ MO', tagBg: '#f2f2f5', tagColor: '#6e6e73' },
  { order: 2, final: 2, name: 'James & Priya Rao', meta: '(628) 555-0447 · verified 2:33 PM', tag: '3–6 MO', tagBg: '#fbf6ec', tagColor: '#a3782a' },
  { order: 3, final: 0, name: 'Sarah Mitchell', meta: '(415) 555-0182 · verified 2:41 PM', tag: 'BUYING 0–3 MO', tagBg: '#eafaf0', tagColor: '#1d8f45' },
]

const CRMS = ['Follow Up Boss', 'kvCORE', 'Lofty', 'Sierra Interactive', 'Real Geeks']

const NAV_LINKS = [
  { href: '#how', label: 'How It Works' },
  { href: '#film', label: 'The Film' },
  { href: '#safety', label: 'Safety' },
  { href: '#report', label: 'Seller Report' },
  { href: '#pricing', label: 'Pricing' },
]

const sectionPad = 'clamp(56px,8vw,96px) clamp(20px,5vw,48px)'
const eyebrow: React.CSSProperties = { fontSize: '13px', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: '#c9963a', marginBottom: '14px' }

// showFilm=false (the homepage, until the 90-second film is delivered) hides
// the #film section plus the nav link and hero anchor that point to it.
export default function TheRecord({ showFilm = true }: { showFilm?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [billing, setBilling] = useState<'monthly' | 'annual' | '2year'>('monthly')
  const navLinks = showFilm ? NAV_LINKS : NAV_LINKS.filter(l => l.href !== '#film')

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const rafs = new Map<HTMLElement, number>()
    let logTicks: ReturnType<typeof setTimeout>[] = []
    let logSettle: ReturnType<typeof setTimeout> | undefined

    // scroll progress + hero parallax
    const prog = root.querySelector<HTMLElement>('[data-progress]')
    const onScroll = () => {
      const h = document.documentElement
      const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)
      if (prog) prog.style.width = (p * 100).toFixed(2) + '%'
      if (!reduced) root.querySelectorAll<HTMLElement>('[data-parallax]').forEach(el => {
        const parent = el.parentElement
        if (!parent) return
        const r = parent.getBoundingClientRect()
        const f = parseFloat(el.dataset.parallax || '0')
        el.style.transform = 'translateY(' + ((r.top + r.height / 2 - innerHeight / 2) * -f).toFixed(1) + 'px)'
      })
    }
    addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    // reveals: hide then rise in on intersect
    const reveals = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!reduced) reveals.forEach(el => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(26px)'
      el.style.transition = 'opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1)'
    })
    // Clear the inline transform (rather than pinning 'none') once revealed —
    // an inline value would permanently override the CSS hover/scroll scale
    // effects on the comparison and pricing cards. The inline transition is
    // dropped after the rise-in finishes for the same reason.
    const show = (el: HTMLElement) => {
      el.style.opacity = '1'
      el.style.transform = ''
      setTimeout(() => { el.style.transition = '' }, 750)
    }
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return
      io.unobserve(e.target)
      show(e.target as HTMLElement)
    }), { threshold: 0.15 })
    reveals.forEach(el => io.observe(el))

    // bars + counters: fill on scroll-in, reset on scroll-out
    const animCount = (c: HTMLElement, to: number) => {
      const prev = rafs.get(c)
      if (prev) cancelAnimationFrame(prev)
      const from = +(c.textContent || 0), t0 = performance.now(), dur = 900
      if (reduced) { c.textContent = String(to); return }
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / dur)
        c.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))))
        if (p < 1) rafs.set(c, requestAnimationFrame(tick))
      }
      rafs.set(c, requestAnimationFrame(tick))
    }
    const animHosts = reveals.filter(el => el.querySelector('[data-bar],[data-count]'))
    const animIO = new IntersectionObserver(es => es.forEach(e => {
      const inView = e.isIntersecting
      e.target.querySelectorAll<HTMLElement>('[data-bar]').forEach(b => b.style.width = (inView ? b.dataset.bar : 0) + '%')
      e.target.querySelectorAll<HTMLElement>('[data-count]').forEach(c => animCount(c, inView ? +(c.dataset.count || 0) : 0))
    }), { threshold: 0.35 })
    animHosts.forEach(el => animIO.observe(el))

    // live-log sequence: rows appear newest-on-top, then reorder hot-first
    const loglist = root.querySelector<HTMLElement>('[data-loglist]')
    let logIO: IntersectionObserver | undefined
    if (loglist) {
      const rows = Array.from(loglist.querySelectorAll<HTMLElement>('[data-logrow]'))
        .sort((a, b) => +(a.dataset.order || 0) - +(b.dataset.order || 0))
      const H = 66
      const place = (row: HTMLElement, slot: number) => row.style.transform = 'translateY(' + slot * H + 'px)'
      const reset = () => {
        logTicks.forEach(clearTimeout); logTicks = []
        if (logSettle) clearTimeout(logSettle)
        rows.forEach(r => { r.style.opacity = '0'; place(r, 0) })
      }
      const play = () => {
        reset()
        if (reduced) { rows.forEach(r => { r.style.opacity = '1'; place(r, +(r.dataset.final || 0)) }); return }
        logTicks = rows.map((row, i) => setTimeout(() => {
          rows.slice(0, i).forEach((r, j) => place(r, i - j))
          row.style.opacity = '1'; place(row, 0)
        }, 500 + i * 700))
        logSettle = setTimeout(() => rows.forEach(r => place(r, +(r.dataset.final || 0))), 500 + rows.length * 700 + 500)
      }
      logIO = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? play() : reset()), { threshold: 0.4 })
      logIO.observe(loglist)
    }

    // fallback: everything visible after 4s regardless
    const fallback = setTimeout(() => reveals.forEach(show), 4000)

    // how-it-works scroll-spy
    const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-step]'))
    const bar = root.querySelector<HTMLElement>('[data-stepbar]')
    const label = root.querySelector<HTMLElement>('[data-steplabel]')
    const spy = new IntersectionObserver(es => es.forEach(e => {
      const el = e.target as HTMLElement, n = +(el.dataset.step || 0)
      el.style.opacity = e.isIntersecting ? '1' : '.35'
      const numeral = el.firstElementChild as HTMLElement | null
      if (numeral) numeral.style.transform = e.isIntersecting ? 'scale(1.08)' : 'none'
      if (e.isIntersecting) {
        if (bar) bar.style.width = (n * 20) + '%'
        if (label) label.textContent = 'Step ' + n + ' of 5'
      }
    }), { rootMargin: '-40% 0px -40% 0px' })
    steps.forEach(el => spy.observe(el))

    // comparison cards: hover handles desktop; on touch devices (no hover)
    // the card crossing the center band of the screen gets the same effect
    let cmpIO: IntersectionObserver | undefined
    if (!reduced && matchMedia('(hover: none)').matches) {
      cmpIO = new IntersectionObserver(es => es.forEach(e => {
        const el = e.target as HTMLElement
        const cls = el.classList.contains('rec-cmp-win') ? 'rec-cmp-win-active'
          : el.classList.contains('rec-safety') ? 'rec-safety-active' : 'rec-cmp-active'
        el.classList.toggle(cls, e.isIntersecting)
      }), { rootMargin: '-40% 0px -40% 0px' })
      root.querySelectorAll<HTMLElement>('.rec-cmp, .rec-cmp-win, .rec-safety').forEach(el => cmpIO!.observe(el))
    }

    return () => {
      removeEventListener('scroll', onScroll)
      io.disconnect(); animIO.disconnect(); spy.disconnect()
      if (cmpIO) cmpIO.disconnect()
      if (logIO) logIO.disconnect()
      logTicks.forEach(clearTimeout)
      if (logSettle) clearTimeout(logSettle)
      clearTimeout(fallback)
      rafs.forEach(cancelAnimationFrame)
    }
  }, [])

  return (
    // overflow:clip (not hidden — hidden would break the sticky nav) stops
    // iOS Safari from extending the document's scroll area past the footer
    // for transformed/animated descendants (phantom white space below footer).
    <div ref={rootRef} style={{ background: '#1d1d1f', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", WebkitFontSmoothing: 'antialiased', overflow: 'clip' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet" />

      <style>{`
        html{scroll-behavior:smooth}
        .rec a{color:inherit;text-decoration:none}
        .rec-nav-links a:hover{color:#fff}
        .rec-link:hover{color:#c9963a}
        .rec-btn{transition:transform .2s}
        .rec-btn:hover{transform:translateY(-2px)}
        .rec-play{transition:transform .2s}
        .rec-play:hover{transform:scale(1.08)}
        .rec-cmp{transition:transform .25s}
        .rec-cmp:hover,.rec-cmp-active{transform:scale(.97)}
        .rec-cmp-win{transition:transform .25s,box-shadow .25s}
        .rec-cmp-win:hover,.rec-cmp-win-active{transform:scale(1.03);box-shadow:0 22px 52px rgba(29,29,31,.35)}
        .rec-safety{transition:transform .25s,box-shadow .25s}
        .rec-safety:hover,.rec-safety-active{transform:translateY(-4px);box-shadow:0 14px 32px rgba(29,29,31,.1)}
        .rec-tier{transition:transform .25s,box-shadow .25s}
        .rec-tier:hover{transform:translateY(-4px);box-shadow:0 14px 32px rgba(29,29,31,.1)}
        .rec-tier-dark:hover{box-shadow:0 18px 40px rgba(29,29,31,.35)}
        .rec-nav-links{display:flex;gap:26px;font-size:13.5px;font-weight:600;color:rgba(255,255,255,.75);align-items:center}
        .rec-burger{display:none}
        @media (max-width:860px){.rec-nav-links{display:none}.rec-burger{display:block}}
        @keyframes om-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes om-rise{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
        @keyframes om-pulse{0%,100%{box-shadow:0 0 0 0 rgba(48,209,88,.5)}50%{box-shadow:0 0 0 8px rgba(48,209,88,0)}}
        @media (prefers-reduced-motion:reduce){.rec *{animation:none!important;transition:none!important}}
      `}</style>

      <div className="rec">
        {/* scroll progress */}
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', zIndex: 99, background: 'rgba(255,255,255,.08)' }}>
          <div data-progress="1" style={{ height: '3px', width: '0%', background: 'linear-gradient(90deg,#c9963a,#e0b25e)' }} />
        </div>

        {/* nav */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px clamp(20px,5vw,48px)', background: 'rgba(29,29,31,.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div onClick={() => { setMenuOpen(false); window.scrollTo({ top: 0 }) }} style={{ fontWeight: 800, fontSize: '18px', color: '#fff', letterSpacing: '-.02em', cursor: 'pointer' }}>oh<span style={{ color: '#c9963a' }}>ACCESS</span></div>
          <div className="rec-nav-links">
            {navLinks.map(l => <a key={l.href} href={l.href} style={{ padding: '8px 0' }}>{l.label}</a>)}
            <Link href="/login" style={{ padding: '8px 0' }}>Sign-In</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link href="/login?signup=true" className="rec-btn" style={{ background: '#c9963a', color: '#1d1d1f', fontWeight: 700, fontSize: '13.5px', padding: '11px 18px', borderRadius: '6px', whiteSpace: 'nowrap' }}>Start Free</Link>
            <button className="rec-burger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer', padding: '4px 6px' }}>{menuOpen ? '✕' : '☰'}</button>
          </div>
        </div>

        {/* mobile menu */}
        {menuOpen && (
          <div style={{ position: 'sticky', top: '64px', zIndex: 49, background: '#2a2a2c', padding: '16px clamp(20px,5vw,48px)', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,.85)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            {navLinks.map(l => <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>{l.label}</a>)}
            <Link href="/login" onClick={() => setMenuOpen(false)}>Sign-In</Link>
          </div>
        )}

        {/* hero */}
        <div style={{ background: '#1d1d1f', color: '#fff', padding: 'clamp(48px,8vw,96px) clamp(20px,5vw,48px) 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,440px),1fr))', gap: 'clamp(28px,4vw,48px)', alignItems: 'end', overflow: 'hidden' }}>
          <div style={{ paddingBottom: 'clamp(40px,6vw,80px)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.22em', color: '#c9963a', textTransform: 'uppercase', marginBottom: '22px', animation: 'om-rise .7s .05s both' }}>For real estate agents · Patent pending</div>
            <h1 style={{ fontSize: 'clamp(42px,6.4vw,76px)', lineHeight: .98, fontWeight: 800, letterSpacing: '-.035em', textWrap: 'balance', margin: 0 }}>
              <span style={{ display: 'inline-block', animation: 'om-rise .7s .12s both' }}>The clipboard</span> <span style={{ display: 'inline-block', animation: 'om-rise .7s .22s both' }}>has been</span> <span style={{ display: 'inline-block', color: '#c9963a', animation: 'om-rise .7s .34s both' }}>lying to you.</span>
            </h1>
            <p style={{ fontSize: 'clamp(16px,1.6vw,19px)', lineHeight: 1.55, color: 'rgba(255,255,255,.72)', margin: '24px 0 32px', maxWidth: '44ch', animation: 'om-rise .7s .45s both' }}>Fake names. Dead numbers. Ink nobody can read. <strong>ohACCESS</strong> verifies every Open House visitor at the door with a one-time code word — sent to a phone and email that actually work.</p>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', animation: 'om-rise .7s .55s both' }}>
              <Link href="/login?signup=true" className="rec-btn" style={{ background: '#c9963a', color: '#1d1d1f', fontWeight: 700, fontSize: '16px', padding: '15px 28px', borderRadius: '8px' }}>Start Free — 25 check-ins</Link>
              {showFilm && <a href="#film" style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,.8)', borderBottom: '1px solid rgba(255,255,255,.35)', paddingBottom: '2px' }}>Watch 90 seconds ↓</a>}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,.45)', marginTop: '16px', animation: 'om-rise .7s .62s both' }}>No credit card. Verified leads by Sunday.</div>
          </div>
          <div style={{ height: 'clamp(360px,44vw,560px)', position: 'relative' }}>
            <div data-parallax="0.12" style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
              <Image src="/record-hero.jpg" alt="Visitor at a front door scanning the ohACCESS QR sign with her phone" fill sizes="(max-width: 900px) 100vw, 50vw" priority style={{ objectFit: 'cover' }} />
            </div>
            <div data-reveal="1" style={{ position: 'absolute', left: 'clamp(-16px,-1vw,-10px)', bottom: '36px', background: 'rgba(29,29,31,.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.15)', borderRadius: '14px', padding: '14px 18px', display: 'flex', gap: '12px', alignItems: 'center', boxShadow: '0 12px 32px rgba(0,0,0,.4)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#30d158', animation: 'om-pulse 2s infinite' }} />
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff' }}>New visitor verified</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.6)' }}>Sarah M. · buying in 0–3 months</div>
              </div>
            </div>
          </div>
        </div>

        {/* marquee ticker */}
        <div style={{ background: '#c9963a', overflow: 'hidden', padding: '13px 0', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'inline-flex', gap: 0, animation: 'om-marquee 22s linear infinite' }}>
            {[0, 1].map(i => (
              <div key={i} style={{ display: 'inline-flex', gap: '48px', paddingRight: '48px', fontSize: '13px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#1d1d1f' }}>
                <span>No real phone → no code word → no entry</span><span>·</span><span>Live visitor log</span><span>·</span><span>Instant alerts</span><span>·</span><span>CRM delivery</span><span>·</span><span>Seller report card</span><span>·</span>
              </div>
            ))}
          </div>
        </div>

        {/* how it works */}
        <div id="how" style={{ background: '#fff', padding: sectionPad, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 'clamp(32px,5vw,72px)' }}>
          <div style={{ position: 'sticky', top: '96px', alignSelf: 'start' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: '#6e6e73' }}>How it works</div>
            <div style={{ fontSize: 'clamp(30px,3.4vw,42px)', fontWeight: 800, letterSpacing: '-.03em', color: '#1d1d1f', marginTop: '12px', lineHeight: 1.05 }}>Ten seconds to understand.<br /><span style={{ color: '#c9963a' }}>Thirty to check-in.</span></div>
            <div style={{ marginTop: '22px', height: '3px', width: '120px', background: '#ececf0', borderRadius: '2px' }}>
              <div data-stepbar="1" style={{ height: '3px', width: '20%', background: '#c9963a', borderRadius: '2px', transition: 'width .4s' }} />
            </div>
            <div data-steplabel="1" style={{ fontSize: '13px', fontWeight: 700, color: '#6e6e73', marginTop: '10px' }}>Step 1 of 5</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {STEPS.map((s, i) => (
              <div key={s.n} data-step={s.n} style={{ display: 'flex', gap: 'clamp(16px,3vw,28px)', padding: 'clamp(24px,3vw,36px) 0', borderBottom: i < STEPS.length - 1 ? '1px solid #e5e5ea' : 'none', alignItems: 'baseline', transition: 'opacity .4s', opacity: .35 }}>
                <div style={{ fontSize: 'clamp(40px,5vw,56px)', fontWeight: 800, color: s.n === 5 ? '#30d158' : '#c9963a', letterSpacing: '-.03em', width: '64px', flex: 'none', transition: 'transform .4s' }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 'clamp(18px,2vw,22px)', fontWeight: 700, color: '#1d1d1f' }}>{s.title}</div>
                  <div style={{ fontSize: '15px', lineHeight: 1.55, color: '#6e6e73', marginTop: '5px', maxWidth: '44ch' }}>{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* the 90-second film — hidden on the homepage until the film is delivered */}
        {showFilm && <div id="film" style={{ background: '#f5f5f7', padding: 'clamp(56px,8vw,96px) 0' }}>
          <div style={{ padding: '0 clamp(20px,5vw,48px)' }}>
            <div style={{ ...eyebrow, marginBottom: '10px' }}>The 90-second film</div>
            <div style={{ fontSize: 'clamp(28px,3.4vw,38px)', fontWeight: 800, letterSpacing: '-.03em', color: '#1d1d1f', maxWidth: '24ch' }}>One Open House, from yard sign to seller report.</div>
          </div>
          {/* FILM SLOT — replace the poster with the final poster frame and wire
              the play button to a native <video> when the film is delivered. */}
          <div data-reveal="1" style={{ margin: '36px clamp(20px,5vw,48px) 0', position: 'relative', aspectRatio: '16/9', borderRadius: '18px', overflow: 'hidden', background: '#1d1d1f', boxShadow: '0 24px 64px rgba(29,29,31,.3)' }}>
            <Image src="/record-hero.jpg" alt="" fill sizes="100vw" style={{ objectFit: 'cover', opacity: .55 }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'linear-gradient(to top,rgba(29,29,31,.55),rgba(29,29,31,.15))', pointerEvents: 'none' }}>
              <div className="rec-play" style={{ width: '84px', height: '84px', borderRadius: '50%', background: '#c9963a', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 34px rgba(0,0,0,.4)', pointerEvents: 'auto', cursor: 'pointer' }}>
                <div style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '14px 0 14px 24px', borderColor: 'transparent transparent transparent #1d1d1f', marginLeft: '6px' }} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', letterSpacing: '.04em' }}>WATCH THE FILM · 1:30</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', padding: '44px clamp(20px,5vw,48px) 0' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#1d1d1f' }}>Read the story, scene by scene</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#6e6e73' }}>scroll the strip →</div>
          </div>
          <div data-reveal="1" style={{ display: 'flex', gap: '14px', overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '36px clamp(20px,5vw,48px) 12px', scrollbarWidth: 'thin' }}>
            {SCENES.map((sc, i) => (
              <div key={i} style={{ flex: 'none', width: 'min(72vw,290px)', scrollSnapAlign: 'start', background: sc.dark ? '#1d1d1f' : '#fff', borderRadius: '14px', padding: '22px 22px 24px', boxShadow: sc.dark ? 'none' : '0 2px 10px rgba(0,0,0,.05)' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#c9963a', letterSpacing: '.06em' }}>SCENE {i + 1} · {sc.time}</div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: sc.dark ? '#fff' : '#1d1d1f', margin: '10px 0 8px' }}>{sc.title}</div>
                <div style={{ fontSize: '14px', lineHeight: 1.55, color: sc.dark ? 'rgba(255,255,255,.85)' : '#1d1d1f' }}>{sc.body}</div>
                <div style={{ fontSize: '13.5px', lineHeight: 1.55, color: sc.dark ? 'rgba(255,255,255,.6)' : '#6e6e73', fontStyle: 'italic', marginTop: '12px', borderLeft: '2px solid #c9963a', paddingLeft: '12px' }}>{sc.vo}</div>
              </div>
            ))}
          </div>
        </div>}

        {/* live log → CRM */}
        <div id="leads" style={{ background: '#1d1d1f', color: '#fff', padding: sectionPad, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 'clamp(36px,5vw,64px)', alignItems: 'center' }}>
          <div>
            <div style={eyebrow}>Live log → your CRM</div>
            <div style={{ fontSize: 'clamp(30px,4vw,44px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.05, maxWidth: '18ch' }}>Your follow-up list writes itself.</div>
            <p style={{ fontSize: 'clamp(15px,1.5vw,17px)', lineHeight: 1.6, color: 'rgba(255,255,255,.7)', margin: '22px 0 28px', maxWidth: '46ch' }}>Every check-in appears in your live visitor log the moment the code word is issued — name, verified phone and email, buying timeline. When the event ends, the whole list is already in your CRM. No transcribing, no Monday data entry.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '15px', fontWeight: 600 }}>
              {['Instant alert on every new visitor', 'Hot buyers flagged: 0–3 month timelines up top', 'Automated post-event report in your inbox'].map(t => (
                <div key={t} style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}><span style={{ color: '#30d158', fontWeight: 800 }}>✓</span><span>{t}</span></div>
              ))}
            </div>
          </div>
          <div data-reveal="1" style={{ justifySelf: 'center', width: 'min(92vw,440px)', background: '#fff', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.45)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#f5f5f7', borderBottom: '1px solid #ececf0' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#1d1d1f' }}>412 Larchmont Ave · Live</div>
                <div style={{ fontSize: '11.5px', color: '#6e6e73' }}>Sunday 2:47 PM · doors open</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#eafaf0', borderRadius: '999px', padding: '6px 12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#30d158', animation: 'om-pulse 2s infinite' }} />
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#1d8f45' }}>14 verified</span>
              </div>
            </div>
            <div data-loglist="1" style={{ position: 'relative', height: '264px' }}>
              {LOG_ROWS.map(r => (
                <div key={r.name} data-logrow="1" data-order={r.order} data-final={r.final} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '66px', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid #f2f2f5', background: '#fff', transition: 'transform .6s cubic-bezier(.22,1,.36,1),opacity .4s', opacity: 0 }}>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1d1d1f' }}>{r.name}</div>
                    <div style={{ fontSize: '11.5px', color: '#6e6e73' }}>{r.meta}</div>
                  </div>
                  <span style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '.04em', background: r.tagBg, color: r.tagColor, padding: '4px 9px', borderRadius: '5px' }}>{r.tag}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px', background: '#f5f5f7', borderTop: '1px solid #ececf0' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#1d1d1f', whiteSpace: 'nowrap' }}>→ Syncing to your CRM</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {CRMS.map(c => <span key={c} style={{ fontSize: '10.5px', fontWeight: 700, color: '#6e6e73', background: '#fff', border: '1px solid #e5e5ea', borderRadius: '5px', padding: '4px 8px' }}>{c}</span>)}
              </div>
            </div>
          </div>
        </div>

        {/* comparison */}
        <div style={{ background: '#fff', padding: sectionPad }}>
          <div style={{ fontSize: 'clamp(28px,3.4vw,38px)', fontWeight: 800, letterSpacing: '-.03em', color: '#1d1d1f', marginBottom: '8px' }}>The sign-in sheet, on trial.</div>
          <div style={{ fontSize: '16px', color: '#6e6e73', marginBottom: '32px' }}>What actually happens to a visitor’s contact info, three ways.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: '16px' }}>
            <div data-reveal="1" className="rec-cmp" style={{ border: '1px solid #e5e5ea', borderRadius: '14px', padding: '26px 26px 28px' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#1d1d1f' }}>Paper sheet</div>
              <div style={{ fontSize: '12.5px', color: '#a8a8ad', margin: '2px 0 16px' }}>The clipboard</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', lineHeight: 1.5, color: '#6e6e73' }}>
                {['Fake names, made-up numbers, zero verification', 'Handwriting you decode days later — or never', 'Never reaches your CRM; looks dated to sellers'].map(t => (
                  <div key={t} style={{ display: 'flex', gap: '9px' }}><span style={{ color: '#c0392b', fontWeight: 800 }}>✕</span><span>{t}</span></div>
                ))}
              </div>
            </div>
            <div data-reveal="1" className="rec-cmp" style={{ border: '1px solid #e5e5ea', borderRadius: '14px', padding: '26px 26px 28px' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#1d1d1f' }}>Generic form apps</div>
              <div style={{ fontSize: '12.5px', color: '#a8a8ad', margin: '2px 0 16px' }}>Digital, but unverified</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', lineHeight: 1.5, color: '#6e6e73' }}>
                <div style={{ display: 'flex', gap: '9px' }}><span style={{ color: '#c9963a', fontWeight: 800 }}>△</span><span>Typed and legible — but never verified</span></div>
                <div style={{ display: 'flex', gap: '9px' }}><span style={{ color: '#c0392b', fontWeight: 800 }}>✕</span><span>555-1234 goes in as easily as a real number</span></div>
                <div style={{ display: 'flex', gap: '9px' }}><span style={{ color: '#c0392b', fontWeight: 800 }}>✕</span><span>Garbage in, garbage out — follow-up dies</span></div>
              </div>
            </div>
            <div data-reveal="1" className="rec-cmp-win" style={{ background: '#1d1d1f', borderRadius: '14px', padding: '26px 26px 28px', boxShadow: '0 16px 40px rgba(29,29,31,.25)' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#c9963a' }}>ohACCESS</div>
              <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,.5)', margin: '2px 0 16px' }}>Verified at the door</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', lineHeight: 1.5, color: 'rgba(255,255,255,.9)' }}>
                {['Code word proves phone + email are real — before entry', 'Every visitor logged, timeline captured, delivered to your CRM', 'Seller report card proves the turnout was real'].map(t => (
                  <div key={t} style={{ display: 'flex', gap: '9px' }}><span style={{ color: '#30d158', fontWeight: 800 }}>✓</span><span>{t}</span></div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '16px', color: '#6e6e73', marginTop: '18px' }}>Doing nothing is worse than all three: no record at all of who was inside the seller’s home.</div>
        </div>

        {/* safety / deterrence */}
        <div id="safety" style={{ background: '#f5f5f7', padding: sectionPad }}>
          <div style={{ maxWidth: '980px', margin: '0 auto' }}>
            <div style={eyebrow}>Safety</div>
            <div data-reveal="1" style={{ fontSize: 'clamp(30px,4.2vw,52px)', fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1.04, color: '#1d1d1f', textWrap: 'balance' }}>You host strangers in an empty house every weekend. <span style={{ color: '#6e6e73' }}>A verified name at the door changes who shows up.</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: '16px', marginTop: '40px' }}>
              {[
                { title: 'Deterrence at the door', body: 'Anyone entering knows their identity is verified and on the record. People behave differently when they’re not anonymous.' },
                { title: 'You’re never in the dark', body: 'Instant new-visitor alerts tell you who’s walking in — name and timeline — before you let them in.' },
                { title: 'A record for the seller, too', body: 'A complete, verified log of who was inside the home — accountability the paper sheet never offered.' },
              ].map(c => (
                <div key={c.title} data-reveal="1" className="rec-safety" style={{ background: '#fff', borderRadius: '14px', padding: '26px 26px 28px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#1d1d1f' }}>{c.title}</div>
                  <div style={{ fontSize: '14px', lineHeight: 1.55, color: '#6e6e73', marginTop: '7px' }}>{c.body}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '16px', color: '#6e6e73', marginTop: '20px' }}><strong>ohACCESS</strong> is a deterrence layer — not a substitute for your safety practices or brokerage protocols.</div>
          </div>
        </div>

        {/* seller report */}
        <div id="report" style={{ background: '#1d1d1f', color: '#fff', padding: sectionPad, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 'clamp(36px,5vw,64px)', alignItems: 'center' }}>
          <div>
            <div style={eyebrow}>The seller report card</div>
            <div style={{ fontSize: 'clamp(32px,4vw,44px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.05, maxWidth: '18ch' }}>The text that wins your next listing.</div>
            <p style={{ fontSize: 'clamp(15px,1.5vw,17px)', lineHeight: 1.6, color: 'rgba(255,255,255,.7)', margin: '22px 0 28px', maxWidth: '46ch' }}>After every Open House, <strong>ohACCESS</strong> builds a report you can send the homeowner in one tap: verified turnout, buyer timelines, proof the afternoon was worth it. Sellers talk. So do their neighbors.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '15px', fontWeight: 600 }}>
              {['Verified visitor count — full transparency, no guesses', 'Buyer timelines: who’s buying in 0–3 months', 'Sharable with your seller in one tap'].map(t => (
                <div key={t} style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}><span style={{ color: '#30d158', fontWeight: 800 }}>✓</span><span>{t}</span></div>
              ))}
            </div>
          </div>
          <div data-reveal="1" style={{ justifySelf: 'center', width: 'min(88vw,320px)', background: '#000', borderRadius: '44px', padding: '12px', boxShadow: '0 30px 80px rgba(0,0,0,.5)' }}>
            <div style={{ background: '#f5f5f7', borderRadius: '34px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 22px 6px', fontSize: '12px', fontWeight: 700, color: '#1d1d1f' }}><span>2:47</span><span>▲ ▂ ▆</span></div>
              <div style={{ padding: '14px 18px 24px' }}>
                <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,.06)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#c9963a' }}>Seller report card</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#1d1d1f', marginTop: '6px' }}>412 Larchmont Ave</div>
                  <div style={{ fontSize: '12.5px', color: '#6e6e73' }}>Open House · Sun July 19, 1–4 PM</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '18px 0 4px' }}>
                    <span data-count="14" style={{ fontSize: '42px', fontWeight: 800, color: '#1d1d1f', letterSpacing: '-.03em' }}>0</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#30d158' }}>verified visitors</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6e6e73', marginBottom: '14px' }}>Every contact confirmed by phone + email</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { label: 'Buying in 0–3 months', count: 5, pct: 36, color: '#30d158', delay: '' },
                      { label: '3–6 months', count: 4, pct: 29, color: '#c9963a', delay: ' .15s' },
                      { label: '6+ months / 12+ months', count: 5, pct: 36, color: '#a8a8ad', delay: ' .3s' },
                    ].map(b => (
                      <div key={b.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#1d1d1f', marginBottom: '3px' }}><span>{b.label}</span><span>{b.count}</span></div>
                        <div style={{ height: '7px', borderRadius: '4px', background: '#ececf0' }}>
                          <div data-bar={b.pct} style={{ width: '0%', height: '7px', borderRadius: '4px', background: b.color, transition: `width 1s${b.delay} cubic-bezier(.22,1,.36,1)` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#a8a8ad', marginTop: '16px', textAlign: 'center' }}>Powered by <strong>ohACCESS</strong> · Patent Pending</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <div style={{ background: '#c9963a', color: '#1d1d1f', fontSize: '13px', fontWeight: 700, padding: '9px 16px', borderRadius: '16px 16px 4px 16px' }}>Great turnout Sunday! Full report above 👆</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* pricing */}
        <div id="pricing" style={{ background: '#fff', padding: sectionPad }}>
          <div style={{ fontSize: 'clamp(28px,3.4vw,38px)', fontWeight: 800, letterSpacing: '-.03em', color: '#1d1d1f', marginBottom: '8px' }}>Priced like a lockbox, not like software.</div>
          <div style={{ fontSize: '16px', color: '#6e6e73', marginBottom: '24px' }}>Start Free. One verified lead pays for decades.</div>
          <div style={{ display: 'inline-flex', background: '#f5f5f7', borderRadius: '10px', padding: '4px', gap: '2px', marginBottom: '28px', flexWrap: 'wrap' }}>
            {(['monthly', 'annual', '2year'] as const).map(b => (
              <button key={b} onClick={() => setBilling(b)} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, background: billing === b ? '#1d1d1f' : 'transparent', color: billing === b ? '#fff' : '#6e6e73' }}>
                {b === 'monthly' ? 'Monthly' : b === 'annual' ? 'Annual' : '2 Years*'}
                {b === 'annual' && <span style={{ marginLeft: '6px', background: '#30d158', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '10px' }}>2 MOS FREE</span>}
                {b === '2year' && <span style={{ marginLeft: '6px', background: '#c9963a', color: '#1d1d1f', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '10px' }}>BEST VALUE</span>}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: '16px' }}>
            {([
              {
                name: 'Trial', dark: false,
                desc: 'Try the full Pro experience',
                price: { monthly: 'Free', annual: 'Free', '2year': 'Free' },
                per: { monthly: '', annual: '', '2year': '' },
                note: { monthly: '25 registrations · no credit card', annual: '25 registrations · no credit card', '2year': '25 registrations · no credit card' },
                features: <>Full Pro features<br />SMS + email delivery<br />Visitor log + CSV</>,
              },
              {
                name: 'Pro', dark: true,
                desc: 'For the active agent',
                price: { monthly: '$15', annual: '$12.50', '2year': '$10' },
                per: { monthly: '/mo', annual: '/mo', '2year': '/mo' },
                note: { monthly: ' ', annual: 'Billed $150/yr — 2 months free', '2year': '$240 every 2 years — year 2 half off' },
                features: <>Unlimited Open Houses<br />Unlimited registrations<br />Instant SMS alerts · CRM sync</>,
              },
              {
                name: 'Team', dark: false,
                desc: '2–10 agents',
                price: { monthly: '$120', annual: '$100', '2year': '$80' },
                per: { monthly: '/mo', annual: '/mo', '2year': '/mo' },
                note: { monthly: ' ', annual: 'Billed $1,200/yr — 2 months free', '2year': '$1,920 every 2 years — year 2 half off' },
                features: <>All Pro features<br />Brand customization<br />Team logo</>,
              },
              {
                name: 'Brokerage', dark: false,
                desc: '11–100 agents',
                price: { monthly: '$11', annual: '$110', '2year': '$176' },
                per: { monthly: '/agent/mo', annual: '/agent/yr', '2year': '/agent/2yr' },
                note: { monthly: ' ', annual: '2 months free', '2year': 'Year 2 half off' },
                features: <>All Team features<br />Branded visitor emails<br />Add agents anytime</>,
              },
            ] as const).map(tier => (
              <div key={tier.name} data-reveal="1" className={tier.dark ? 'rec-tier rec-tier-dark' : 'rec-tier'} style={tier.dark
                ? { background: '#1d1d1f', borderRadius: '14px', padding: '28px 24px', position: 'relative' }
                : { border: '1px solid #e5e5ea', borderRadius: '14px', padding: '28px 24px' }}>
                {tier.dark && <div style={{ position: 'absolute', top: '14px', right: '14px', background: '#c9963a', color: '#1d1d1f', fontSize: '10px', fontWeight: 800, letterSpacing: '.1em', padding: '5px 10px', borderRadius: '5px' }}>MOST POPULAR</div>}
                <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: tier.dark ? '#c9963a' : '#6e6e73', width: 'fit-content' }}>{tier.name}</div>
                <div style={{ fontSize: '12.5px', color: tier.dark ? 'rgba(255,255,255,.5)' : '#a8a8ad', marginTop: '2px' }}>{tier.desc}</div>
                <div style={{ fontSize: '34px', fontWeight: 800, color: tier.dark ? '#fff' : '#1d1d1f', margin: '10px 0 2px' }}>{tier.price[billing]}<span style={{ fontSize: '15px', fontWeight: 600, color: tier.dark ? 'rgba(255,255,255,.6)' : '#6e6e73' }}>{tier.per[billing]}</span></div>
                <div style={{ fontSize: '13px', color: tier.dark ? 'rgba(255,255,255,.6)' : '#6e6e73', marginBottom: '16px' }}>{tier.note[billing]}</div>
                <div style={{ fontSize: '13.5px', lineHeight: 1.7, color: tier.dark ? '#fff' : '#1d1d1f' }}>{tier.features}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '12px', color: '#6e6e73', textAlign: 'center', marginTop: '24px', fontStyle: 'italic' }}>
            * 2-year pricing is a founding-member offer available for a limited time only. Paid upfront and renews automatically every 2 years — we&apos;ll email you before each renewal, and you can cancel anytime. More than 100 agents? <a href="/contact" style={{ color: '#c9963a' }}>Contact us</a> for custom pricing.
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
            <Link href="/login?signup=true" className="rec-btn" style={{ background: '#1d1d1f', color: '#fff', fontWeight: 700, fontSize: '16px', padding: '16px 34px', borderRadius: '8px' }}>Verify your first Open House free →</Link>
          </div>
        </div>

        {/* footer */}
        <div style={{ background: '#1d1d1f', padding: '30px clamp(20px,5vw,48px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>Powered by oh<span style={{ color: '#c9963a' }}>ACCESS</span></div>
          <div style={{ display: 'flex', gap: '24px', fontSize: '12.5px', color: 'rgba(255,255,255,.5)' }}>
            <a href="/terms" className="rec-link">Visitor Terms</a>
            <a href="/privacy" className="rec-link">Privacy</a>
            <a href="/contact" className="rec-link">Contact</a>
          </div>
          <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,.5)' }}>© 2026 <strong>ohACCESS</strong> · Patent Pending</div>
        </div>
      </div>
    </div>
  )
}
