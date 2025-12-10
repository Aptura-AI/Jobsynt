import { NextResponse } from 'next/server';
import { readJSON, writeJSON } from '@/utils/fs';
import { getAuthTokenFromCookies, verifyToken } from '@/utils/auth';

type Candidate = {
  id: string;
  status?: string;
  notes?: string;
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const candidates = await readJSON<Candidate[]>('candidates.json');
  const candidate = candidates.find((c) => c.id === params.id);
  if (!candidate) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(candidate);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = getAuthTokenFromCookies();
  const session = token ? verifyToken(token) : null;
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const payload = await req.json();
  const candidates = await readJSON<Candidate[]>('candidates.json');
  const idx = candidates.findIndex((c) => c.id === params.id);
  if (idx === -1) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  candidates[idx] = { ...candidates[idx], ...payload };
  await writeJSON('candidates.json', candidates);
  return NextResponse.json(candidates[idx]);
}

