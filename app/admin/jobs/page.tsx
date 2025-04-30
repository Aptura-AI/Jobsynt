// app/admin/jobs/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

interface Job {
  id: string;
  title: string;
  location: string;
  created_at: string;
}

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, location, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching jobs:', error.message);
      } else {
        setJobs(data || []);
      }
      setLoading(false);
    };

    fetchJobs();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold text-violet-400 mb-6">Admin: Internal Jobs</h1>

      {loading ? (
        <p>Loading jobs...</p>
      ) : jobs.length === 0 ? (
        <p>No internal jobs uploaded yet.</p>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => (
            <Link
              key={job.id}
              href={`/admin/jobs/${job.id}`}
              className="block p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition"
            >
              <div className="text-xl font-semibold">{job.title}</div>
              <div className="text-sm text-zinc-400">{job.location}</div>
              <div className="text-xs text-zinc-500 mt-1">
                Posted on {new Date(job.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
