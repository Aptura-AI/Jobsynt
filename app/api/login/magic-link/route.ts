import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Support both NEXT_PUBLIC_ and non-prefixed versions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { email } = payload;

    if (!email) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ message: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Send magic link for login
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.jobsynt.com'}/auth/callback`,
      },
    });

    if (error) {
      return NextResponse.json({ message: error.message || 'Unable to send magic link' }, { status: 400 });
    }

    return NextResponse.json(
      {
        message: 'Check your email for the magic link to sign in',
        email,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Magic link error:', error);
    return NextResponse.json({ message: 'Unable to send magic link' }, { status: 500 });
  }
}

