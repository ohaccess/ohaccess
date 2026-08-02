import { headers, cookies } from 'next/headers'
import { getClientIpFromHeaders } from '@/lib/rate-limit'
import { getOpenHouseDisplay } from '@/lib/open-house-display'
import { VISITOR_COOKIE, parseVisitorPrefill } from '@/lib/visitor-prefill'
import RegisterClient from './RegisterClient'

// Server page: fetches the safe display data (and records the qr_scans
// entry) during the initial render, so the visitor's phone gets the form
// with the data already in it instead of loading a spinner and then making
// a second round trip to /api/open-house/[id]. This page is the phone-at-
// the-front-door path — every saved round trip matters.
export default async function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const h = await headers()

  const openHouse = await getOpenHouseDisplay(id, {
    ip: getClientIpFromHeaders(h),
    userAgent: h.get('user-agent'),
  })

  // Returning visitor: /api/register saved their contact info in a cookie on
  // this device at a previous ohACCESS open house (any agent's). Garbage or
  // absent parses to null and the form simply starts blank.
  const jar = await cookies()
  const returningVisitor = parseVisitorPrefill(jar.get(VISITOR_COOKIE)?.value)

  return <RegisterClient id={id} initialOpenHouse={openHouse} returningVisitor={returningVisitor} />
}
