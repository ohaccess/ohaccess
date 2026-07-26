import type { Metadata } from 'next'
import TheRecord from './new/TheRecord'

// Homepage browser tab = the clean brand tagline. `absolute` skips the
// "%s · ohACCESS" template; other pages keep the SEO-rich layout default
// ("… for Real Estate Agents"). openGraph/social still come from layout.tsx.
export const metadata: Metadata = {
  title: { absolute: 'ohACCESS – Verified Open House Check-In' },
}

// Homepage: "The Record" design, promoted from /new on 2026-07-23 with the
// 90-second-film section hidden until the film is delivered. When it arrives,
// wire the video into TheRecord's film section and flip showFilm to true (or
// drop the prop). References: /new = complete design incl. film placeholder,
// /old = archived previous homepage. SEO metadata inherits from layout.tsx.
export default function Home() {
  return <TheRecord showFilm={false} />
}
