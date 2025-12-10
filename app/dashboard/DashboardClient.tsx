'use client';

import { useState } from 'react';
import DashboardTable from '@/components/DashboardTable';
import SearchBar from '@/components/SearchBar';
import { filterCandidates } from '@/utils/filters';

type Candidate = {
  id: string;
  name: string;
  title: string;
  location: string;
  skills: string[];
  experience: number;
  status?: string;
  notes?: string;
  resumeUrl?: string;
};

export default function DashboardClient({ candidates }: { candidates: Candidate[] }) {
  const [search, setSearch] = useState('');
  const [list, setList] = useState(candidates);
  const filtered = filterCandidates(list, { search, skills: [], location: '', minExperience: undefined });

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

