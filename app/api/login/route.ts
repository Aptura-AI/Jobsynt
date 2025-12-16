import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJSON } from '@/utils/fs';
import { signToken, setAuthCookie, verifyPassword } from '@/utils/auth';
import type { UserRole } from '@/lib/auth-routing';

// Support both NEXT_PUBLIC_ and non-prefixed versions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

type User = {
  email: string;
  passwordHash: string;
  role: UserRole;
};

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { email, password } = payload;

    // Master admin login (fixed credentials)
    if (email.toLowerCase() === 'info@jobsynt.com' && password === 'Jobsynt@2026') {
      const token = signToken({
        email: 'info@jobsynt.com',
        role: 'admin',
        admin_master: true,
      });
      setAuthCookie(token);
      return NextResponse.json({
        email: 'info@jobsynt.com',
        role: 'admin',
        admin_master: true,
      });
    }

    // Try Supabase first if configured
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.user) {
        // Default to candidate, role will be fetched from database in auth flow
        const token = signToken({
          email: data.user.email!,
          role: 'candidate', // Default, actual role comes from profiles table
        });
        setAuthCookie(token);
        return NextResponse.json({
          email: data.user.email,
          role: 'candidate', // Default, actual role comes from profiles table
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
    
    // user.role is already typed as UserRole, use it directly
    const role: UserRole = user.role;
    
    const token = signToken({ email: user.email, role });
    setAuthCookie(token);
    return NextResponse.json({ email: user.email, role });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }
}

