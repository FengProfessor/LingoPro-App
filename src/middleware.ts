import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log('--- DIAGNOSTIC MIDDLEWARE ---', pathname);
  
  // Return early for static files
  if (pathname.includes('.') || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  // LOG EVERYTHING AND ALLOW EVERYTHING
  // This should bypass any "hidden" redirects by being the explicit middleware.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
