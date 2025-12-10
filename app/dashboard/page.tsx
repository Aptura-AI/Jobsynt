import DashboardTable from '@/components/DashboardTable';
import JobCard from '@/components/JobCard';
import SearchBar from '@/components/SearchBar';
import { filterCandidates } from '@/utils/filters';
import { getAuthTokenFromCookies, verifyToken } from '@/utils/auth';
import { readJSON } from '@/utils/fs';
import { redirect } from 'next/navigation';
import { useState } from 'react';

type Candidate = {
  id: string;
  name: string;
  title: string;
  skills: string[];
  experience: number;
  status?: string;
  notes?: string;
  resumeUrl?: string;
};

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
};

async function getData() {
  const [candidates, jobs] = await Promise.all([
    readJSON<Candidate[]>('candidates.json'),
    readJSON<Job[]>('jobs.json'),
  ]);
  return { candidates, jobs };
}

function DashboardClient({ candidates }: { candidates: Candidate[] }) {
  'use client';
  const [search, setSearch] = useState('');
  const [list, setList] = useState(candidates);
  const filtered = filterCandidates(list, { search, skills: [], location: '', minExperience: null });

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/candidates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setList((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  };

  const updateNotes = async (id: string, notes: string) => {
    await fetch(`/api/candidates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    setList((prev) => prev.map((c) => (c.id === id ? { ...c, notes } : c)));
  };

  return (
    <div className="space-y-4">
      <SearchBar value={search} onChange={setSearch} placeholder="Search candidates by name or title" onSubmit={() => {}} />
      <DashboardTable candidates={filtered} onUpdateStatus={updateStatus} onUpdateNotes={updateNotes} />
    </div>
  );
}

export default async function DashboardPage() {
  const token = getAuthTokenFromCookies();
  const session = token ? verifyToken(token) : null;
  if (!session || session.role !== 'admin') {
    redirect('/login');
  }

  const { candidates, jobs } = await getData();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      <div className="mb-2 space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.1em] text-primary">Admin</p>
        <h1 className="text-3xl font-bold text-ink">Recruiter dashboard</h1>
        <p className="text-muted">Review candidates, assign status, keep internal notes, and see open roles.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <p className="text-sm text-muted">Open jobs</p>
          <p className="text-3xl font-bold text-ink">{jobs.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted">Candidates</p>
          <p className="text-3xl font-bold text-ink">{candidates.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted">Strong/Good</p>
          <p className="text-3xl font-bold text-ink">
            {candidates.filter((c) => c.status === 'Strong' || c.status === 'Good').length}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <DashboardClient candidates={candidates} />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-ink">Open roles</h3>
            <a className="text-sm font-semibold text-primary underline" href="/jobs">
              View all
            </a>
          </div>
          <div className="grid gap-3">
            {jobs.slice(0, 6).map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
            {jobs.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-muted">No jobs available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

