import { NextResponse } from 'next/server';
import { readJSON } from '@/utils/fs';
import { signToken, setAuthCookie, verifyPassword } from '@/utils/auth';

type User = {
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
};

export async function POST(req: Request) {
  const payload = await req.json();
  const users = await readJSON<User[]>('users.json');
  const user = users.find((u) => u.email.toLowerCase() === payload.email.toLowerCase());
  if (!user) {
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }
  const valid = await verifyPassword(payload.password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }
  const token = signToken({ email: user.email, role: user.role });
  setAuthCookie(token);
  return NextResponse.json({ email: user.email, role: user.role });
}

