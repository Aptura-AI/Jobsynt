/**
 * Edge-safe authentication utilities
 * 
 * This file contains only Edge-compatible functions that don't require Node.js modules.
 * Used by middleware.ts which runs on Edge runtime.
 * 
 * DO NOT import Node.js-only modules (jsonwebtoken, bcryptjs, etc.) in this file.
 */

import type { UserRole } from '@/lib/auth-routing';

export type SessionToken = {
  email: string;
  role: UserRole;
  userId?: string;
  admin_master?: boolean;
  company_id?: string;
};

/**
 * Decode JWT token without signature verification
 * Safe for Edge runtime (middleware)
 * Uses only standard Web APIs (atob, JSON.parse)
 * 
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

