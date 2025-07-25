import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware to add pathname to headers for dynamic metadata generation
 */
export function middleware(request: NextRequest) {
  // Clone the request headers
  const requestHeaders = new Headers(request.headers)
  
  // Add the pathname to headers
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  
  // Return response with modified headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    // Match all paths under /arts
    '/arts/:path*',
  ],
}