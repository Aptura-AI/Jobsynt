'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../../lib/supabaseClient';

const JobDetails = () => {
  const router = useRouter();
  const { jobId } = router.query;
  const [job, setJob] = useState<any>(null);
  const [applicants, setApplicants] = useState<any[]>([]);

  useEffect(() => {
    if (jobId) {
      // Fetch job details
      supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching job details:', error.message);
          } else {
            setJob(data);
          }
        });

      // Fetch applicants for this job
      supabase
        .from('applications')
        .select('profile_id')
        .eq('job_id', jobId)
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching applicants:', error.message);
          } else {
            // Get details of each applicant by profile_id
            const profileIds = data.map((app: any) => app.profile_id);
            fetchApplicantsProfiles(profileIds);
          }
        });
    }
  }, [jobId]);

  const fetchApplicantsProfiles = async (profileIds: string[]) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('id', profileIds);
    
    if (error) {
      console.error('Error fetching applicants profiles:', error.message);
    } else {
      setApplicants(data);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white px-4 py-10">
      <h1 className="text-3xl font-bold text-violet-400 mb-6">Job Details</h1>
      {job ? (
        <div className="bg-zinc-900 p-6 rounded-xl shadow-md">
          <h2 className="text-2xl font-semibold">{job.title}</h2>
          <p className="text-sm text-gray-400">{job.company}</p>
          <p className="mt-4">{job.description}</p>

          <div className="mt-6">
            <h3 className="text-xl font-medium">Applicants:</h3>
            {applicants.length > 0 ? (
              applicants.map((applicant: any) => (
                <div key={applicant.id} className="mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{applicant.name}</span>
                    <a
                      href={`/profile/${applicant.id}`}
                      className="text-violet-400 hover:text-violet-500"
                    >
                      View Profile
                    </a>
                  </div>
                  <div className="text-gray-400 text-sm mt-1">{applicant.email}</div>
                  <a
                    href={applicant.resume_url} // Assuming resume_url is stored in the profiles table
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-500 mt-2 block"
                  >
                    View Resume
                  </a>
                </div>
              ))
            ) : (
              <p className="text-gray-400">No applicants yet.</p>
            )}
          </div>
        </div>
      ) : (
        <p>Loading job details...</p>
      )}
    </div>
  );
};

export default JobDetails;
