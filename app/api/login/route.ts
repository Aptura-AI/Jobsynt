import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJSON } from '@/utils/fs';
import { signToken, setAuthCookie, verifyPassword } from '@/utils/auth';

// Support both NEXT_PUBLIC_ and non-prefixed versions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

type User = {
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
};

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { email, password } = payload;

    // Try Supabase first if configured
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.user) {
        const token = signToken({
          email: data.user.email!,
          role: data.user.user_metadata?.role || 'user',
        });
        setAuthCookie(token);
        return NextResponse.json({
          email: data.user.email,
          role: data.user.user_metadata?.role || 'user',
        });
      }
    }

    // Fallback to JSON file storage (for backward compatibility)
    const users = await readJSON<User[]>('users.json');
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    const token = signToken({ email: user.email, role: user.role });
    setAuthCookie(token);
    return NextResponse.json({ email: user.email, role: user.role });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }
}

