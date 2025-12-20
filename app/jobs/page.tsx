import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import JobsClient from './JobsClient';
import { get30DaysAgoDate } from '@/lib/job-filters';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience?: string;
  skills?: string[];
  workMode?: string;
  summary?: string;
  rate?: string;
  url?: string;
  posted_date?: string;
};

type ScrapedJobRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  salary: string | null;
  url: string | null;
  posted_date: string | null;
  work_location_type: 'Remote' | 'Hybrid' | 'Onsite' | null;
  is_remote: boolean | null;
};

async function getJobs(): Promise<Job[]> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const thirtyDaysAgo = get30DaysAgoDate();

    const { data: jobs, error } = await supabase
      .from('scraped_jobs')
      .select('id, title, company, location, description, salary, url, posted_date, work_location_type, is_remote')
      .eq('is_active', true)
      .gte('posted_date', thirtyDaysAgo)
      .order('posted_date', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching jobs:', error);
      return [];
    }

    // Transform to match expected format
    // Priority: work_location_type > is_remote > location string check > raw location
    return (jobs || []).map((job: ScrapedJobRow) => {
      // Determine if job is remote with fallback chain
      const isRemote = 
        job.work_location_type === 'Remote' ||
        (job.work_location_type === null && job.is_remote === true) ||
        (job.work_location_type === null && job.is_remote === null && 
         job.location && job.location.toLowerCase().includes('remote'));

      return {
        id: job.id,
        title: job.title,
        company: job.company,
        location: isRemote ? 'Remote' : (job.location || ''),
        summary: job.description || '',
        rate: job.salary || '',
        url: job.url || undefined,
        posted_date: job.posted_date || undefined,
      };
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }
}

export default async function JobsPage() {
  const jobs = await getJobs();
  cookies(); // keep dynamic to allow future auth usage
  return <JobsClient jobs={jobs} />;
}

