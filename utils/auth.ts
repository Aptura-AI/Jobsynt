import jwt from 'jsonwebtoken';
import type { UserRole } from '@/lib/auth-routing';

const JWT_SECRET = process.env.JWT_SECRET || 'jobsynth-dev-secret';

export type SessionToken = {
  email: string;
  role: UserRole;
  userId?: string;
  admin_master?: boolean;
  company_id?: string;
};

export function signToken(payload: SessionToken): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): SessionToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionToken;
  } catch {
    return null;
  }
}

/**
 * Decode JWT token without signature verification
 * Safe for Edge runtime (middleware)
 * DO NOT use for security-critical operations - use verifyToken() in API routes
 */
export function decodeToken(token: string): SessionToken | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = parts[1];
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    );
    return decoded as SessionToken;
  } catch {
    return null;
  }
}
