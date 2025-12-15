import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getPostAuthRedirect } from '@/lib/auth-routing';

/**
 * Middleware for centralized post-auth routing
 * 
 * Handles:
 * - Redirecting authenticated users based on onboarding status
 * - Protecting admin routes
 * - Redirecting first-time users to onboarding
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

  // Admin routes - only allow admin users
  if (pathname.startsWith('/admin')) {
    const isAdmin = email?.toLowerCase() === 'info@jobsynt.com' || 
                    token.role === 'admin' || 
                    (token as any).admin_master === true;
    
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Company routes - only allow company users
  if (pathname.startsWith('/company') && pathname !== '/company/register' && pathname !== '/company/login') {
    // Check if user is a company (this would need to be in token or checked from DB)
    // For now, allow if they have company_id in token
    if (!(token as any).company_id) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Dashboard/candidate routes - check onboarding status
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/candidates')) {
    try {
      const redirectPath = await getPostAuthRedirect(email, userId, pathname);
      
      // If user is on wrong path, redirect them
      if (pathname.startsWith('/candidates')) {
        // If onboarding complete, redirect to dashboard
        const status = await import('@/lib/auth-routing').then(m => 
          m.getUserOnboardingStatus(email, userId)
        );
        if (status.onboardingComplete && !pathname.includes('/candidates')) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      } else if (pathname.startsWith('/dashboard')) {
        // If not onboarding complete, redirect to candidates
        const status = await import('@/lib/auth-routing').then(m => 
          m.getUserOnboardingStatus(email, userId)
        );
        if (!status.onboardingComplete && !isAdmin) {
          return NextResponse.redirect(new URL('/candidates', request.url));
        }
      }
    } catch (error) {
      console.error('Middleware routing error:', error);
      // On error, allow access (fail open)
    }
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

