import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { readJSON } from '@/utils/fs';

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience: string;
  skills: string[];
  workMode: string;
  rate?: string;
  summary?: string;
  responsibilities?: string[];
  requirements?: string[];
};

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Try Supabase first - use scraped_jobs table
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('scraped_jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        const job = {
          id: data.id,
          title: data.title,
          company: data.company,
          location: data.location,
          experience: data.experience || '',
          skills: Array.isArray(data.skills) ? data.skills : (data.skills ? [data.skills] : []),
          workMode: data.work_location_type || data.work_mode || 'Remote',
          locationType: data.work_location_type || data.location_type || null,
          jobType: data.job_type || null,
          rate: data.salary || data.rate || null,
          summary: data.description || data.summary || '',
          requirements: data.description ? [data.description] : [],
          url: data.url || null,
        };
        return NextResponse.json(job);
      }

      if (error && error.code !== 'PGRST116') {
        console.error('Supabase error:', error);
      }
    }

    // Fallback to JSON file
    try {
      const jobs = await readJSON<Job[]>('jobs.json');
      const job = jobs.find((j) => j.id === id);
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json(job);
    } catch {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('GET job error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
