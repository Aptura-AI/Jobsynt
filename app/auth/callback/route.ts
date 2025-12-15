import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { signToken, setAuthCookie } from '@/utils/auth';
import { getPostAuthRedirect, ensureProfileExists } from '@/lib/auth-routing';

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

    // Ensure profile exists (for OAuth users or first-time email users)
    if (supabaseServiceKey) {
      await ensureProfileExists(
        userId,
        email,
        user.user_metadata?.name || user.user_metadata?.full_name,
        user.user_metadata?.avatar_url || user.user_metadata?.picture
      );
    }

    // Create JWT token for our app
    const token = signToken({
      email,
      role: user.user_metadata?.role || 'user',
    });
    setAuthCookie(token);

    // Determine redirect based on onboarding status
    const redirectPath = await getPostAuthRedirect(email, userId);
    
    return NextResponse.redirect(`${requestUrl.origin}${redirectPath}`);
  }

  return NextResponse.redirect(`${requestUrl.origin}/login`);
}

