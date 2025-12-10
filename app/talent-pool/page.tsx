import CandidateCard from '@/components/CandidateCard';
import CandidateFilters from '@/components/CandidateFilters';
import { filterCandidates } from '@/utils/filters';
import { readJSON } from '@/utils/fs';
import { useState } from 'react';

type Candidate = {
  id: string;
  name: string;
  title: string;
  location: string;
  experience: number;
  skills: string[];
  summary?: string;
};

async function getCandidates() {
  return readJSON<Candidate[]>('candidates.json');
}

function TalentClient({ candidates }: { candidates: Candidate[] }) {
  'use client';
  const [filters, setFilters] = useState({ search: '', location: '', minExperience: null as number | null, skills: [] as string[] });
  const filtered = filterCandidates(candidates, filters);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.1em] text-primary">Talent Pool</p>
        <h1 className="text-3xl font-bold text-ink">Search vetted candidates</h1>
        <p className="text-muted">Filter by skills, location, and experience to shortlist faster.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <CandidateFilters {...filters} onChange={(payload) => setFilters({ ...filters, ...payload })} />
        <div className="grid gap-4">
          {filtered.map((cand) => (
            <CandidateCard key={cand.id} candidate={cand} />
          ))}
          {filtered.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-muted">No candidates match your filters.</div>}
        </div>
      </div>
    </div>
  );
}

export default async function TalentPoolPage() {
  const candidates = await getCandidates();
  return <TalentClient candidates={candidates} />;
}

