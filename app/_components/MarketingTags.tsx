'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { isMarketingPath, loadMarketingTags, trackPageView } from '@/lib/marketing-tags'

// Loads the ad tags (Meta Pixel, Google Ads, optional GA4) on marketing routes
// and reports client-side navigations between them. Renders nothing; the
// where/when rules live in lib/marketing-tags.
export default function MarketingTags() {
  const pathname = usePathname()

  useEffect(() => {
    if (!isMarketingPath(pathname)) return
    // The load itself sends the first page view; only later route changes
    // need one sent by hand.
    if (!loadMarketingTags()) trackPageView()
  }, [pathname])

  return null
}
