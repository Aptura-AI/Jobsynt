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

async function getJobs(): Promise<Job[]> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const thirtyDaysAgo = get30DaysAgoDate();

    const { data: jobs, error } = await supabase
      .from('scraped_jobs')
      .select('id, title, company, location, description, salary, url, posted_date, is_remote')
      .eq('is_active', true)
      .gte('posted_date', thirtyDaysAgo)
      .order('posted_date', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching jobs:', error);
      return [];
    }

    // Transform to match expected format
    return (jobs || []).map((job: any) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.is_remote ? 'Remote' : job.location,
      summary: job.description || '',
      rate: job.salary || '',
      url: job.url,
      posted_date: job.posted_date,
    }));
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

