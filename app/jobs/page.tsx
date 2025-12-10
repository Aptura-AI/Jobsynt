import JobFilters from '@/components/JobFilters';
import JobList from '@/components/JobList';
import { filterJobs } from '@/utils/filters';
import { cookies } from 'next/headers';
import { useState } from 'react';

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience: string;
  skills: string[];
  workMode: string;
  summary?: string;
  rate?: string;
};

async function getJobs() {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || '';
  const res = await fetch(`${base}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to load jobs');
  }
  return (await res.json()) as Job[];
}

function JobsClient({ jobs }: { jobs: Job[] }) {
  'use client';
  const [filters, setFilters] = useState({ search: '', location: '', experience: '', workMode: '', skills: [] as string[] });
  const filtered = filterJobs(jobs, filters);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.1em] text-primary">Open Roles</p>
        <h1 className="text-3xl font-bold text-ink">Jobs tailored to Oracle & Cloud talent</h1>
        <p className="text-muted">Filter by location, experience, skills, and work mode.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <JobFilters {...filters} onChange={(payload) => setFilters({ ...filters, ...payload })} />
        <JobList jobs={filtered} />
      </div>
    </div>
  );
}

export default async function JobsPage() {
  const jobs = await getJobs();
  cookies(); // keep dynamic to allow future auth usage
  return <JobsClient jobs={jobs} />;
}

