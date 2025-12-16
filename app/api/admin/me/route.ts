import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';

/**
 * Admin Session Verification API
 * 
 * This runs in Node runtime (API route) where verifyToken() is safe.
 * Verifies JWT signature and returns admin status.
 */
export async function GET() {
  try {
    const cookieStore = cookies();
    const rawToken = cookieStore.get('jobsynth_token')?.value;

    if (!rawToken) {
      return NextResponse.json(
        { error: 'No token found' },
        { status: 401 }
      );
    }

    // Verify JWT signature (safe in Node runtime)
    const token = verifyToken(rawToken);

    if (!token || !token.email) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (token.role !== 'admin') {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 401 }
      );
    }

    // Return admin session data
    return NextResponse.json({
      email: token.email,
      role: token.role,
      userId: token.userId,
    });
  } catch (error) {
    console.error('Admin session verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

