import { NextResponse } from 'next/server';
import { readJSON, writeJSON } from '@/utils/fs';
import { hashPassword, signToken, setAuthCookie } from '@/utils/auth';

type User = {
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
};

export async function POST(req: Request) {
  const payload = await req.json();
  const users = await readJSON<User[]>('users.json');
  const exists = users.find((u) => u.email.toLowerCase() === payload.email.toLowerCase());
  if (exists) {
    return NextResponse.json({ message: 'User already exists' }, { status: 400 });
  }
  const passwordHash = await hashPassword(payload.password);
  const user: User = { email: payload.email, passwordHash, role: 'user' };
  users.push(user);
  await writeJSON('users.json', users);
  const token = signToken({ email: user.email, role: user.role });
  setAuthCookie(token);
  return NextResponse.json({ email: user.email, role: user.role }, { status: 201 });
}

