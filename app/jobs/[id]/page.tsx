import Button from '@/components/Button';
import { readJSON } from '@/utils/fs';
import { getAuthTokenFromCookies, verifyToken } from '@/utils/auth';
import { notFound, redirect } from 'next/navigation';
import { useState } from 'react';

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience: string;
  skills: string[];
  workMode: string;
  rate?: string;
  responsibilities?: string[];
  requirements?: string[];
  summary?: string;
};

async function getJob(id: string): Promise<Job | undefined> {
  const jobs = await readJSON<Job[]>('jobs.json');
  return jobs.find((j) => j.id === id);
}

function ApplyButton({ jobId, isLoggedIn }: { jobId: string; isLoggedIn: boolean }) {
  'use client';
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    if (!isLoggedIn) {
      window.location.href = `/login?next=/jobs/${jobId}`;
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error('Unable to submit application');
      setMessage('Application submitted. A recruiter will reach out.');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Button onClick={handleApply} loading={loading}>
        Apply
      </Button>
      {message && <span className="text-sm text-muted">{message}</span>}
    </div>
  );
}

export default async function JobDetails({ params }: { params: { id: string } }) {
  const job = await getJob(params.id);
  if (!job) return notFound();
  const token = getAuthTokenFromCookies();
  const session = token ? verifyToken(token) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="card p-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold text-ink">{job.title}</h1>
            <p className="text-sm text-muted">
              {job.company} • {job.location} • {job.workMode}
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">{job.experience} yrs</span>
        </div>
        {job.rate && <p className="mt-2 text-sm font-semibold text-ink">Rate: {job.rate}</p>}
        {job.summary && <p className="mt-3 text-muted">{job.summary}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {job.skills.map((skill) => (
            <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-ink">
              {skill}
            </span>
          ))}
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-ink">Responsibilities</h3>
            <ul className="mt-2 list-disc space-y-2 pl-4 text-muted">
              {job.responsibilities?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-ink">Requirements</h3>
            <ul className="mt-2 list-disc space-y-2 pl-4 text-muted">
              {job.requirements?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-8">
          <ApplyButton jobId={job.id} isLoggedIn={Boolean(session)} />
        </div>
      </div>
    </div>
  );
}

