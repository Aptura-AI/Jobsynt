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

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.user) {
        // Get userId from auth result
        const userId = data.user.id;
        
        // Fetch role from database (single source of truth)
        const { getUserOnboardingStatus } = await import('@/lib/auth-routing');
        const status = await getUserOnboardingStatus(data.user.email!, userId);
        
        const token = signToken({
          email: data.user.email!,
          role: status.role, // Use role from database
          userId,
        });
        setAuthCookie(token);
        return NextResponse.json({
          email: data.user.email,
          role: status.role, // Return actual role from database
        });
      }
      
      // If Supabase auth failed, log the error for debugging
      if (error) {
        console.error('Supabase auth error:', error.message);
        // Return specific error message
        return NextResponse.json({ 
          message: error.message || 'Invalid credentials. User may not exist in Supabase.' 
        }, { status: 401 });
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
    
    // For JSON fallback, userId is not available (no Supabase auth user)
    const token = signToken({ 
      email: user.email, 
      role,
      userId: undefined,
    });
    setAuthCookie(token);
    return NextResponse.json({ email: user.email, role });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }
}

