'use client';

import { useState } from 'react';
import JobFilters from '@/components/JobFilters';
import JobList from '@/components/JobList';
import ApplyForMe from '@/components/ApplyForMe';
import { filterJobs } from '@/utils/filters';
import { useAccessCheck } from '@/lib/hooks/useAccessCheck';
import type { Job } from '@/lib/types';

export default function JobsClient({ jobs }: { jobs: Job[] }) {
  const [filters, setFilters] = useState({ search: '', location: '', experience: '', workMode: '', skills: [] as string[] });
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const { hasAccess } = useAccessCheck();
  
  const filtered = filterJobs(jobs, filters);
  
  const toggleJobSelection = (jobId: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  // Only show Apply for Me for candidates with access
  const showApplyForMe = hasAccess;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-4 sm:mb-6 space-y-2">
        <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.1em] text-primary">Open Roles</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink">Jobs tailored to ERP & Cloud talent</h1>
        <p className="text-sm sm:text-base text-muted">Filter by location, experience, skills, and work mode.</p>
      </div>
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-[280px,1fr] xl:grid-cols-[320px,1fr]">
        <JobFilters {...filters} onChange={(payload) => setFilters({ ...filters, ...payload })} />
        <div>
          {showApplyForMe && (
            <ApplyForMe 
              jobs={filtered.filter(j => selectedJobs.has(j.id)).map(j => ({
                id: j.id,
                title: j.title,
                company: j.company,
                url: j.url,
              }))}
              selectedJobs={selectedJobs}
              onClearSelection={() => setSelectedJobs(new Set())}
            />
          )}
          <JobList 
            jobs={filtered} 
            selectedJobs={selectedJobs}
            onToggleSelection={showApplyForMe ? toggleJobSelection : undefined}
            showCheckbox={showApplyForMe}
          />
        </div>
      </div>
    </div>
  );
}

