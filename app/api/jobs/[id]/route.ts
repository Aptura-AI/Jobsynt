import { NextResponse } from 'next/server';
import { readJSON } from '@/utils/fs';

type Job = {
  id: string;
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const jobs = await readJSON<Job[]>('jobs.json');
  const job = jobs.find((j) => j.id === params.id);
  if (!job) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(job);
}

