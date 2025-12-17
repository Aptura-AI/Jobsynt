'use client';

import { useState } from 'react';
import JobFilters from '@/components/JobFilters';
import JobList from '@/components/JobList';
import { filterJobs } from '@/utils/filters';

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience?: string;
  skills?: string[];
  workMode?: string;
  summary?: string;
  rate?: string;
};

export default function JobsClient({ jobs }: { jobs: Job[] }) {
  const [filters, setFilters] = useState({ search: '', location: '', experience: '', workMode: '', skills: [] as string[] });
  const filtered = filterJobs(jobs, filters);
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-4 sm:mb-6 space-y-2">
        <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.1em] text-primary">Open Roles</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink">Jobs tailored to ERP & Cloud talent</h1>
        <p className="text-sm sm:text-base text-muted">Filter by location, experience, skills, and work mode.</p>
      </div>
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-[280px,1fr] xl:grid-cols-[320px,1fr]">
        <JobFilters {...filters} onChange={(payload) => setFilters({ ...filters, ...payload })} />
        <JobList jobs={filtered} />
      </div>
    </div>
  );
}

