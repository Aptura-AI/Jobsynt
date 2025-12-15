import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Support both NEXT_PUBLIC_ and non-prefixed versions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { email, password } = payload;

    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ message: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Sign up user with Supabase (this will send email verification)
    // Redirect to /candidates for onboarding after verification
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.jobsynt.com'}/auth/callback?type=signup`,
        data: {
          role: 'candidate', // Default role for new signups
        },
      },
    });

    if (error) {
      // Check if user already exists
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        return NextResponse.json({ message: 'User already exists. Please sign in instead.' }, { status: 400 });
      }
      return NextResponse.json({ message: error.message || 'Unable to sign up' }, { status: 400 });
    }

    return NextResponse.json(
      {
        message: 'Check your email to verify your account',
        email: data.user?.email,
        needsVerification: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ message: 'Unable to sign up' }, { status: 500 });
  }
}
