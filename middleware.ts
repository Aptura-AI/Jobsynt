import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decodeToken } from '@/utils/auth';

/**
 * Middleware - ONLY blocks unauthorized access
 * NO redirect logic, NO callbackUrl handling
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes - always allowed
  const publicRoutes = [
    '/login',
    '/signup',
    '/company/register',
    '/company/login',
    '/auth/callback',
    '/api',
  ];

  const isPublicRoute = publicRoutes.some(
    route => pathname === route || pathname.startsWith(route)
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const rawToken = request.cookies.get('jobsynth_token')?.value;
  if (!rawToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const token = decodeToken(rawToken);
  if (!token || !token.role) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname.startsWith('/admin') && token.role !== 'admin') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /**
     * IMPORTANT:
     * - Excludes API routes
     * - Excludes Next internals
     * - Excludes static assets
     * - Excludes ALL route groups like (public), (app), etc.
     */
    '/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|\\(.*\\)).*)',
  ],
};
