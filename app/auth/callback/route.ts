import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { signToken, setAuthCookie } from '@/utils/auth';

// Support both NEXT_PUBLIC_ and non-prefixed versions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');

  if (code && supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`);
    }

    // Create JWT token for our app
    const token = signToken({
      email: data.user.email!,
      role: data.user.user_metadata?.role || 'user',
    });
    setAuthCookie(token);

    return NextResponse.redirect(`${requestUrl.origin}/`);
  }

  return NextResponse.redirect(`${requestUrl.origin}/login`);
}

