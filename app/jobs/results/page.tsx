'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { fetchJobs } from '../fetchJobs'; 

// Function to apply to a job
const applyToJob = async (jobId: string, userId: string) => {
  try {
    if (!userId) {
      throw new Error('User is not signed in');
    }

    const { data, error } = await supabase
      .from('job_applications')
      .insert([
        {
          job_id: jobId,
          profile_id: userId,
          status: 'applied', // initial status
          applied_at: new Date().toISOString(), // current timestamp
        },
      ]);

    if (error) throw error;
    console.log('Job application submitted:', data);

    return data;
  } catch (error) {
    console.error('Error applying to job:', error);
    return null;
  }
};

const JobSearchPage = () => {
  const router = useRouter();
  const [jobs, setJobs] = useState<{ id: string; title: string; location: string; salary: string }[]>([]);
  const [user, setUser] = useState<string | null>(null); // Store logged-in user

  // Define formData state
  const [formData, setFormData] = useState({
    keyword: '',
    location: '',
    jobType: '',
  });

  useEffect(() => {
    const load = async () => {
      const jobs = await fetchJobs({
        query: formData.keyword,         // whatever your search input state is
        location: formData.location,     // optional filters
        employment_type: formData.jobType,
        date_posted: undefined,
        pages: 1,
      });
      setJobs(jobs);
    };
    load();
  }, [formData]);

  useEffect(() => {
    // Get logged-in user
    const getUser = async () => {
      const session = await supabase.auth.getSession();
      setUser(session?.data?.session?.user?.id || null);
    };

    getUser();
  }, []);

  const handleApply = async (jobId: string) => {
    if (!user) {
      alert('Please sign in to apply!');
      return;
    }
    
    const result = await applyToJob(jobId, user);
    if (result) {
      alert('Successfully applied!');
    } else {
      alert('Failed to apply. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-10">
      <h1 className="text-3xl font-bold text-violet-400 mb-6">Job Search Results</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {jobs.map((job) => (
          <div key={job.id} className="bg-zinc-900 p-6 rounded-xl shadow-md">
            <h3 className="text-xl font-semibold text-violet-400">{job.title}</h3>
            <p className="text-sm">{job.location}</p>
            <p className="text-sm">{job.salary}</p>
            <a href={`/jobs/${job.id}`} className="text-violet-400 hover:text-violet-500">
              <button
            onClick={() => handleApply(job.id)}
            className="w-full mt-4 bg-violet-500 hover:bg-violet-600 text-white font-semibold py-2 px-4 rounded"
            >
            Apply to Job
            </button>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobSearchPage;
