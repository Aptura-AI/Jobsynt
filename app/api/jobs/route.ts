import { NextResponse } from 'next/server';
import { readJSON, writeJSON } from '@/utils/fs';
import { v4 as uuid } from 'uuid';

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience: string;
  skills: string[];
  workMode: string;
  rate?: string;
  summary?: string;
  responsibilities?: string[];
  requirements?: string[];
};

export async function GET() {
  const jobs = await readJSON<Job[]>('jobs.json');
  return NextResponse.json(jobs);
}

export async function POST(req: Request) {
  const payload = await req.json();
  const jobs = await readJSON<Job[]>('jobs.json');
  const job: Job = {
    id: payload.id || `job-${uuid()}`,
    title: payload.title,
    company: payload.company,
    location: payload.location,
    experience: payload.experience,
    skills: payload.skills || [],
    workMode: payload.workMode || 'remote',
    rate: payload.rate,
    summary: payload.summary,
    responsibilities: payload.responsibilities || [],
    requirements: payload.requirements || [],
  };
  jobs.push(job);
  await writeJSON('jobs.json', jobs);
  return NextResponse.json(job, { status: 201 });
}

