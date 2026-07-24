# Handoff: ohACCESS Landing Page — "The Record" (Live build)

## Overview
Full redesign of the ohACCESS marketing landing page (ohaccess.com), direction "The Record": bold, editorial, dark-hero layout on the existing brand palette, with 2026-style scroll motion throughout.

**Deployment intent: parallel/secondary page.** Ship this at a secondary route (e.g. `/record` or `/new`, noindexed) alongside the current landing page. The 90-second film is still in production — the film section ships with a poster-frame placeholder and play button until the video is delivered. When the film is done: drop in the video file + poster frame, review, then promote this page to `/` and retire the old one.

## About the Design Files
The files here are **design references created in HTML** — a working prototype showing exact look and behavior, not production code to ship directly. Recreate the design in the site's existing environment and patterns; if there is no existing stack, a static site or Next.js page is a fine fit. `support.js` and `image-slot.js` are prototype runtime files — reference only, do not ship.

## Fidelity
**High-fidelity.** Colors, type, spacing, copy, and motion are final as shown in `The Record - Live.dc.html`. The prototype is fully responsive (fluid `clamp()` sizing, `auto-fit` grids, desktop → 390px mobile) — recreate the same responsive behavior, not a fixed breakpoint port. All measurements live in the inline styles.

## Design Tokens
- Font: **Plus Jakarta Sans** (Google Fonts), 400–800. Headings 800, letter-spacing −0.02em to −0.035em.
- Colors: near-black `#1d1d1f`, warm gold `#c9963a`, gray text `#6e6e73`, light bg `#f5f5f7`, hairlines `#e5e5ea`, white, success green `#30d158`, gold tint `#fbf6ec`.
- Radii: buttons 6–8px, cards 10–18px, phone mockup 44px outer / 34px inner.
- Backgrounds alternate `#1d1d1f` ↔ white/`#f5f5f7` only.

## Sections (top → bottom; anchor ids in the prototype)
1. **Nav** — dark, logo "ohACCESS" (gold "ACCESS"), links How it works / Why it wins / Seller report / Pricing; Sign in + gold "Start free". Mobile: logo + Start free + hamburger. Thin gold scroll-progress bar under the nav.
2. **Hero** — dark 2-col: gold eyebrow "FOR REAL ESTATE AGENTS · PATENT PENDING"; H1 "The clipboard has been lying to you."; gold CTA "Start free — 25 check-ins" + "Watch 90 seconds ↓"; microcopy "No credit card. Verified leads by Sunday." Right: photo (visitor scanning QR sign at sunlit door) with 0.12 parallax + floating verification chip card.
3. **Gold ticker strip** — `#c9963a`, uppercase deterrence lines ("No real phone → no code word → no entry").
4. **`#how` How it works** — white; sticky left rail, 5 scroll-spy steps (Scan / Register / Code word / Verified entry / Leads land), gold numerals (step 5 green), per-step progress bars that fill as each step enters view.
5. **`#film` The 90-second film** — `#f5f5f7`; 16:9 video-player card: poster-frame image slot + gold 84px play button + duration chip. This is where the final video drops in. Below: horizontal snap filmstrip of the 7 scenes.
6. **Comparison — "The sign-in sheet, on trial."** — white; Paper / Generic form apps / ohACCESS cards, ohACCESS tinted `#fbf6ec` with green ✓s; cards swell/shrink on hover.
7. **`#leads` Live log → your CRM** — dark; animated live-log rows pop in and reorder by buyer timeline (0–3 mo / 3–6 mo / 6–12+ mo), flowing into CRM dashboard mock with integration logos: Follow Up Boss, kvCORE, Lofty, Sierra, Real Geeks.
8. **`#safety` Safety / deterrence** — `#f5f5f7`; "A verified name at the door changes who shows up."
9. **`#report` Seller report** — dark 2-col; phone mockup with report card (412 Larchmont Ave, 14 verified visitors, timeline bars 36/29/36%, "Powered by ohACCESS · Patent Pending"), gold outgoing-text bubble; stat numbers count up on scroll-in.
10. **`#pricing` Pricing** — white; "Priced like a lockbox, not like software." / "Start free. One verified lead pays for decades." 4 tiers in a 2px black border: Trial Free (25 registrations) / Pro $15/mo (dark cell, gold "MOST POPULAR") / Team $120/mo (2–10 agents) / Brokerage $11/agent/mo (11–100).
11. **Footer** — dark; Visitor Terms / Privacy / Contact; "© 2026 ohACCESS · Patent Pending".

## Interactions & Motion
All behavior is implemented in the prototype's script — read it as the spec. Summary:
- Scroll-reveal (`data-reveal`) rise-in on section entry; animations reset when scrolled out and reverse on direction change.
- Hero parallax (`data-parallax="0.12"`); nav scroll-progress bar.
- How-it-works scroll-spy with per-step progress fills.
- Live-log rows: timed pop-in, pulse (green `om-pulse`), reorder animation.
- Count-up numbers in the seller report.
- Comparison card hover swell; gold buttons darken on hover; nav links → white.
- **Reduced motion:** `prefers-reduced-motion: reduce` kills all animations/transitions (CSS `*{animation:none;transition:none}` + JS checks) — preserve this.
- CTAs → existing signup flow (keep current links working); "Watch 90 seconds" scrolls to `#film`; play button is a no-op until the video exists.

## Video placeholder → final film
- Film section ships as poster + play button. When the film arrives: replace the poster slot with the poster frame, wire the play button to play the video in-place (native `<video>` is fine), keep the 16:9 card and shadow.
- `google-flow-film-prompts.md` contains one Google Flow prompt per scene for generating the film — separate workstream, not part of the web build.

## State Management
Static marketing page — no app state beyond mobile nav open/close and the scroll-driven animation state above.

## Assets
- Photography: placeholders (`<image-slot>`) in the prototype; generation prompts in `image-prompts.md`.
- Phone mockup, report card, CRM dashboard: build in HTML/CSS as prototyped.
- CRM integration logos: source official brand assets (placeholder text in prototype).
- Font: Plus Jakarta Sans via Google Fonts.

## Files
- `The Record - Live.dc.html` — the prototype: all layout, measurements, copy, and the full animation script.
- `image-prompts.md` — AI image-generation prompts.
- `google-flow-film-prompts.md` — per-scene prompts for the 90-second film.
- `image-slot.js`, `support.js` — prototype runtime, reference only.

## Suggested Claude Code workflow
1. Work on a branch: `git checkout -b landing/the-record` (back up first if the site isn't in git).
2. Prompt:
   > "Read design_handoff_the_record/README.md. Recreate the landing page from `The Record - Live.dc.html` in our existing stack as a NEW page at a secondary route (e.g. /record), leaving the current landing page untouched. Match layout, copy, and the scroll animations described in the README (the prototype's script is the spec). Keep existing signup links working. Add noindex until we promote it."
3. Review on staging; once the video is delivered, drop it into the film section, then promote the page to `/`.
