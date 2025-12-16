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

  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(route)
  );

  // Allow all public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Get token from cookies
  const rawToken = request.cookies.get('jobsynth_token')?.value;
  if (!rawToken) {
    // No token - redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const token = decodeToken(rawToken);
  if (!token || !token.role) {
    // Invalid token - redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ENFORCEMENT: /admin requires admin role
  if (pathname.startsWith('/admin')) {
    if (token.role !== 'admin') {
      // Non-admin trying to access /admin - redirect to login
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // All other routes allowed if token is valid
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};