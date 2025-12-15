import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'jobsynth-dev-secret';
const TOKEN_NAME = 'jobsynth_token';

export type SessionToken = {
  email: string;
  role: 'admin' | 'user';
  admin_master?: boolean;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

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

export function getAuthTokenFromCookies(): string | undefined {
  const store = cookies();
  return store.get(TOKEN_NAME)?.value;
}

export function setAuthCookie(token: string) {
  const store = cookies();
  store.set(TOKEN_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAuthCookie() {
  const store = cookies();
  store.delete(TOKEN_NAME);
}

