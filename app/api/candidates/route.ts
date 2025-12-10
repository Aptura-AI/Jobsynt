import { NextResponse } from 'next/server';
import { readJSON, writeJSON } from '@/utils/fs';
import { v4 as uuid } from 'uuid';

type Candidate = {
  id: string;
  name: string;
  email?: string;
  title: string;
  location: string;
  experience: number;
  skills: string[];
  visa?: string;
  rate?: string;
  availability?: string;
  summary?: string;
  projects?: string[];
  status?: string;
  notes?: string;
  resumeUrl?: string;
};

export async function GET() {
  const candidates = await readJSON<Candidate[]>('candidates.json');
  return NextResponse.json(candidates);
}

export async function POST(req: Request) {
  const payload = await req.json();
  const candidates = await readJSON<Candidate[]>('candidates.json');
  const candidate: Candidate = {
    id: payload.id || `cand-${uuid()}`,
    name: payload.name,
    email: payload.email,
    title: payload.title,
    location: payload.location,
    experience: Number(payload.experience || 0),
    skills: payload.skills || [],
    visa: payload.visa,
    rate: payload.rate,
    availability: payload.availability,
    summary: payload.summary,
    projects: payload.projects || [],
    status: 'Good',
    notes: '',
    resumeUrl: payload.resumeUrl || '',
  };
  candidates.push(candidate);
  await writeJSON('candidates.json', candidates);
  return NextResponse.json(candidate, { status: 201 });
}

