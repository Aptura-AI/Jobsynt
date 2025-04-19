'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchFromJSearch } from '../../utils/jobsFetcher'; // Import the function for JSearch API

const JobResultsPage = () => {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = localStorage.getItem('jobSearchParams');
    if (!params) {
      router.push('/jobs');
      return;
    }

    const searchParams = JSON.parse(params);
    fetchJobs(searchParams);
  }, [router]);

  const fetchJobs = async (searchParams: any) => {
    try {
      // Fetch real data from JSearch API using the search parameters
      const result = await fetchFromJSearch(searchParams.keyword); // Modify based on the parameter you want to pass
      setJobs(result); // Set the real data into state
    } catch (err) {
      setError('Failed to fetch job listings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white px-4 py-10">
      <h1 className="text-3xl font-bold text-violet-400 mb-6">Job Results</h1>

      {loading && (
        <div className="flex justify-center items-center h-60 text-violet-500">Loading jobs...</div>
      )}

      {error && (
        <div className="flex justify-center items-center h-60 text-red-500">{error}</div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="flex justify-center items-center h-60 text-gray-400">No jobs found matching your criteria.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((job: any, index: number) => (
          <div key={index} className="bg-zinc-800 p-4 rounded-lg shadow-md space-y-4">
            <h3 className="text-lg font-semibold text-violet-400">{job.job_title || 'Job Title'}</h3>
            <p className="text-sm text-zinc-400">{job.company_name || 'Company Name'}</p>
            <p className="text-sm text-zinc-300">{job.location || 'Location'}</p>
            <p className="text-sm text-zinc-300">{job.job_type || 'Full-time'}</p>
            <p className="text-sm text-zinc-300">{job.job_description?.substring(0, 120) + '...'}</p>
            <a
              href={job.job_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-500 hover:underline"
            >
              View Job
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobResultsPage;
