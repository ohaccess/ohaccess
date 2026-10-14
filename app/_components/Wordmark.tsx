// The "ohACCESS" wordmark in the nav bar of every public page, homepage
// included, so the size and weights can't drift apart again (before
// 2026-10-14 the homepage had it at 18px/800 with gold ACCESS while the
// other pages had 22px with a thin "oh" and all-white text). White "oh",
// gold "ACCESS": the same treatment as the hero and the footer's
// "Powered by". Inline span so it sits inside whatever Link or div the
// page already wraps it in.

export default function Wordmark({ size = '22px' }: { size?: string }) {
  return (
    <span style={{ fontWeight: 800, fontSize: size, color: '#fff', letterSpacing: '-.02em', lineHeight: 1, whiteSpace: 'nowrap' }}>
      oh<span style={{ color: '#c9963a' }}>ACCESS</span>
    </span>
  )
}
