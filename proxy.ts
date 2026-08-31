import { NextResponse, type NextRequest } from 'next/server'

// Server-side capture of Meta's click id. Ad clicks land with ?fbclid=…, and
// normally fbevents.js writes it to the _fbc cookie — but that's lost when the
// visitor bounces before the pixel initializes, blocks it, or the tags aren't
// loaded on the landing path. Setting the cookie here on the first request
// means the Conversions API leg (app/api/meta-event) can attribute the
// eventual signup to the ad click even when the browser pixel never ran.
//
// fb.1.<ms>.<fbclid> is the exact format the pixel itself writes, so when the
// pixel does run it recognizes the cookie and leaves it alone. Deliberately
// NOT httpOnly for the same reason. The matcher below keeps this proxy off
// every request that doesn't need it: it only runs at all when fbclid is in
// the URL and no _fbc cookie exists yet.
export function proxy(request: NextRequest) {
  const fbclid = request.nextUrl.searchParams.get('fbclid')
  if (
    !fbclid ||
    !/^[A-Za-z0-9_-]{1,500}$/.test(fbclid) ||
    request.cookies.has('_fbc') ||
    // Same stance as lib/marketing-tags: Global Privacy Control means no ad
    // attribution state gets created on this browser's behalf.
    request.headers.get('sec-gpc') === '1'
  ) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const host = request.nextUrl.hostname
  const onProdDomain = host === 'ohaccess.com' || host.endsWith('.ohaccess.com')
  response.cookies.set('_fbc', `fb.1.${Date.now()}.${fbclid}`, {
    // Scope to .ohaccess.com in production so www/apex share it; on preview
    // deploys and localhost a domain attribute would make the browser reject
    // the cookie, so fall back to host-only there.
    ...(onProdDomain ? { domain: '.ohaccess.com' } : {}),
    maxAge: 60 * 60 * 24 * 90,
    sameSite: 'lax',
    path: '/',
    secure: request.nextUrl.protocol === 'https:',
  })
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api/|_next/|.*\\..*).*)',
      has: [{ type: 'query', key: 'fbclid' }],
      missing: [{ type: 'cookie', key: '_fbc' }],
    },
  ],
}
