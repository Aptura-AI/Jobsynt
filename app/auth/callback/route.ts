import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { signToken } from '@/utils/auth';
import { setAuthCookie } from '@/utils/auth.server';
import { getPostAuthRedirect, ensureProfileExists, getUserOnboardingStatus, type UserRole } from '@/lib/auth-routing';

// Support both NEXT_PUBLIC_ and non-prefixed versions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Supabase Auth Callback Handler
 * 
 * Handles:
 * - Email verification redirects
 * - OAuth callbacks (Google, LinkedIn)
 * - Post-auth routing based on onboarding status
 * 
 * HARDENED: Ensures profile exists with correct defaults
 */
export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type'); // 'signup' or 'recovery'

  if (code && supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`);
    }

    const user = data.user;
    const email = user.email!;
    const userId = user.id;

    // HARDENED: Ensure profile exists with correct defaults
    // - role defaults to 'candidate' (unless already admin in DB)
    // - onboarding_complete defaults to false
    // - Link user_id to existing profile if pending_auth
    if (supabaseServiceKey) {
      await ensureProfileExists(
        userId,
        email,
        user.user_metadata?.name || user.user_metadata?.full_name,
        user.user_metadata?.avatar_url || user.user_metadata?.picture
      );
      
      // If this is a password reset flow, ensure pending_auth is cleared
      if (type === 'recovery') {
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
        await adminSupabase
          .from('profiles')
          .update({ pending_auth: false })
          .eq('email', email)
          .eq('user_id', userId);
      }
    }

    // Get role from database (single source of truth)
    const status = await getUserOnboardingStatus(email, userId);

    // Create JWT token with role from database
    // status.role is already UserRole type ('admin' | 'candidate' | 'company')
    // Ensure type safety by using the role directly (no cast needed)
    const role: UserRole = status.role;
    const token = signToken({
      email,
      role,
      userId,
    });
    setAuthCookie(token);

    // Determine redirect based on onboarding status
    // Admin users NEVER go to /candidates
    const redirectPath = await getPostAuthRedirect(email, userId);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔀 Auth callback redirect: ${email} → ${redirectPath}`);
    }
    
    return NextResponse.redirect(`${requestUrl.origin}${redirectPath}`);
  }

  return NextResponse.redirect(`${requestUrl.origin}/login`);
}

