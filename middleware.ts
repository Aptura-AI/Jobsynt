import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getPostAuthRedirect, getUserOnboardingStatus, isAdminUser } from '@/lib/auth-routing';

/**
 * Middleware for centralized post-auth routing
 * 
 * ENFORCES:
 * - /admin → admin only (role === 'admin')
 * - /candidates → non-admin AND onboarding_complete === false
 * - /dashboard → non-admin AND onboarding_complete === true
 * 
 * Prevents:
 * - Admin seeing candidate pages
 * - Candidates seeing admin
 * - Candidates skipping onboarding
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't need auth
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/company/register',
    '/company/login',
    '/auth/callback',
    '/api',
  ];

  // Check if route is public
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(route)
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Get session token
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  });

  // If no token and trying to access protected route, redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const email = token.email as string;
  const userId = token.id as string;

  // Get user status from database (single source of truth)
  let userStatus;
  try {
    userStatus = await getUserOnboardingStatus(email, userId);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Middleware: Error fetching user status:', error);
    }
    // On error, allow access (fail open) to prevent blocking users
    return NextResponse.next();
  }

  const userRole = userStatus.role;
  const isAdmin = isAdminUser(userRole);

  // ENFORCEMENT 1: /admin → admin only
  if (pathname.startsWith('/admin')) {
    if (!isAdmin) {
      // Non-admin trying to access admin route - redirect to their correct dashboard
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚫 Blocked non-admin access to /admin: ${email} (role=${userRole})`);
      }
      try {
        const redirectPath = await getPostAuthRedirect(email, userId);
        return NextResponse.redirect(new URL(redirectPath, request.url));
      } catch {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
    // Admin accessing /admin - allow
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Admin access granted to /admin: ${email}`);
    }
    return NextResponse.next();
  }

  // ENFORCEMENT 2: Admin users must NOT see candidate pages
  if (isAdmin && (pathname.startsWith('/candidates') || pathname.startsWith('/dashboard'))) {
    // Admin trying to access candidate pages - redirect to /admin
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚫 Redirected admin from candidate page to /admin: ${email}`);
    }
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // ENFORCEMENT 3: /candidates → non-admin AND onboarding_complete === false
  if (pathname.startsWith('/candidates')) {
    if (userStatus.onboardingComplete) {
      // Onboarding complete - redirect to dashboard
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚫 Redirected from /candidates (onboarding complete): ${email}`);
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // Onboarding incomplete - allow access
    return NextResponse.next();
  }

  // ENFORCEMENT 4: /dashboard → non-admin AND onboarding_complete === true
  if (pathname.startsWith('/dashboard')) {
    if (!userStatus.onboardingComplete) {
      // Onboarding incomplete - redirect to candidates
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚫 Redirected from /dashboard (onboarding incomplete): ${email}`);
      }
      return NextResponse.redirect(new URL('/candidates', request.url));
    }
    // Onboarding complete - allow access
    return NextResponse.next();
  }

  // Company routes - only allow company users
  if (pathname.startsWith('/company') && pathname !== '/company/register' && pathname !== '/company/login') {
    if (userRole !== 'company' && !(token as any).company_id) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

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

