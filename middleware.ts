import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/utils/auth';
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

  // Public routes that don't need auth (but admins will be redirected)
  const publicRoutes = [
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

  // Get jobsynth_token from cookies
  const rawToken = request.cookies.get('jobsynth_token')?.value;
  const token = rawToken ? verifyToken(rawToken) : null;

  // Handle root path separately - redirect admins to /admin
  if (pathname === '/') {
    if (token) {
      const email = token.email;
      const userId = token.userId;
      
      try {
        const userStatus = await getUserOnboardingStatus(email, userId);
        if (userStatus.role === 'admin') {
          // Admin accessing root - redirect to /admin
          if (process.env.NODE_ENV === 'development') {
            console.log(`🚫 Redirected admin from / to /admin: ${email}`);
          }
          return NextResponse.redirect(new URL('/admin', request.url));
        }
      } catch (error) {
        // On error, allow access to root
        if (process.env.NODE_ENV === 'development') {
          console.error('Middleware: Error checking admin status for /:', error);
        }
      }
    }
    
    // Non-admin or no token - allow access to root
    return NextResponse.next();
  }

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // If no token and trying to access protected route, redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const email = token.email;
  const userId = token.userId;
  
  // Verify token has role embedded
  const tokenRole = token.role;
  if (process.env.NODE_ENV === 'development' && tokenRole) {
    console.log('[MIDDLEWARE] Token role:', tokenRole);
  }

  // Get user status from database (single source of truth)
  let userStatus;
  try {
    userStatus = await getUserOnboardingStatus(email, userId);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Middleware: Error fetching user status:', error);
    }
    // On error, use token role as fallback if available
    if (tokenRole && tokenRole === 'admin') {
      // If token says admin but DB query failed, still allow admin access
      if (pathname.startsWith('/admin')) {
        return NextResponse.next();
      }
      if (pathname === '/') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      // Admin trying to access other routes - redirect to /admin
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    // On error, allow access (fail open) to prevent blocking users
    return NextResponse.next();
  }

  const userRole = userStatus.role;
  const isAdmin = isAdminUser(userRole);
  
  // Verify token role matches database role (for debugging)
  if (process.env.NODE_ENV === 'development' && tokenRole && tokenRole !== userRole) {
    console.warn(`[MIDDLEWARE] Role mismatch: token=${tokenRole}, db=${userRole} - using DB role`);
  }

  // ENFORCEMENT 1: /admin → admin only
  if (pathname.startsWith('/admin')) {
    if (!isAdmin) {
      // Non-admin trying to access admin route - redirect to their correct dashboard
      if (process.env.NODE_ENV === 'development') {
        console.log('[MIDDLEWARE BLOCK]', pathname, userRole, '→ redirecting to dashboard');
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
    if (userRole !== 'company' && !token.company_id) {
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
