// app/jobs/[id]/page.tsx
'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const JobDetail = () => {
  const params = useParams();
  const id = params?.id;

  useEffect(() => {
    if (!id) return;

    const saveJob = async () => {
      // Replace this with your actual data fetching logic
      const jobData = await fetchJobDetails(id);

      const { error } = await supabase.from('jobs').insert([jobData]);

      if (error) {
        console.error('Error saving job:', error);
      } else {
        console.log('Job saved successfully.');
      }
    };

    saveJob();
  }, [id]);

  return (
    <div>
      <h1>Job Details</h1>
      {/* Render job details here */}
    </div>
  );
};

export default JobDetail;
function fetchJobDetails(id: string | string[]) {
  throw new Error('Function not implemented.');
}

