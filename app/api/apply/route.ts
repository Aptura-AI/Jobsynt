import { NextResponse } from 'next/server';
import { getAuthTokenFromCookies, verifyToken } from '@/utils/auth';
import { readJSON, writeJSON } from '@/utils/fs';
import { v4 as uuid } from 'uuid';

type Application = {
  id: string;
  jobId: string;
  email: string;
  createdAt: string;
};

export async function POST(req: Request) {
  const token = getAuthTokenFromCookies();
  const session = token ? verifyToken(token) : null;
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const payload = await req.json();
  const applications = await readJSON<Application[]>('applications.json');
  const application: Application = {
    id: `app-${uuid()}`,
    jobId: payload.jobId,
    email: session.email,
    createdAt: new Date().toISOString(),
  };
  applications.push(application);
  await writeJSON('applications.json', applications);
  return NextResponse.json(application, { status: 201 });
}

