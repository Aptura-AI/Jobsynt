import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { readJSON, writeJSON } from '@/utils/fs';
import { v4 as uuid } from 'uuid';

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

export async function GET() {
  try {
    // Try Supabase first
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        // Transform to match expected format
        const jobs = data.map((job: any) => ({
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          experience: job.experience || '',
          skills: job.skills || [],
          workMode: job.work_mode || 'remote',
          rate: job.rate,
          summary: job.summary,
          responsibilities: job.responsibilities || [],
          requirements: job.requirements || [],
        }));

        // If no jobs, trigger a background scrape with default keywords
        if (jobs.length === 0 && (process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN)) {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL 
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
            || 'http://localhost:3000';
          fetch(`${baseUrl}/api/scan-jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords: [] }),
          }).catch(console.error);
        }

        return NextResponse.json(jobs);
      }
      
      if (error) {
        console.log('Supabase jobs error:', error.message);
      }
      return NextResponse.json([]); // DB configured but no jobs
    }

    // If Supabase not configured, return empty (no fake/sample jobs)
    return NextResponse.json([]);
  } catch (error: any) {
    console.error('GET jobs error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Try Supabase first
    if (isSupabaseConfigured()) {
      const jobData = {
        title: payload.title,
        company: payload.company,
        location: payload.location,
        experience: payload.experience,
        skills: payload.skills || [],
        work_mode: payload.workMode || 'remote',
        rate: payload.rate,
        summary: payload.summary,
        responsibilities: payload.responsibilities || [],
        requirements: payload.requirements || [],
        url: payload.url,
        source: payload.source || 'manual',
        is_active: true,
      };

      const { data, error } = await supabase
        .from('jobs')
        .insert(jobData)
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Transform response
      const job = {
        id: data.id,
        title: data.title,
        company: data.company,
        location: data.location,
        experience: data.experience,
        skills: data.skills,
        workMode: data.work_mode,
        rate: data.rate,
        summary: data.summary,
        responsibilities: data.responsibilities,
        requirements: data.requirements,
      };

      return NextResponse.json(job, { status: 201 });
    }

    // Fallback to JSON file (local dev only)
    try {
      const jobs = await readJSON<Job[]>('jobs.json');
      const job: Job = {
        id: payload.id || `job-${uuid()}`,
        title: payload.title,
        company: payload.company,
        location: payload.location,
        experience: payload.experience,
        skills: payload.skills || [],
        workMode: payload.workMode || 'remote',
        rate: payload.rate,
        summary: payload.summary,
        responsibilities: payload.responsibilities || [],
        requirements: payload.requirements || [],
      };
      jobs.push(job);
      await writeJSON('jobs.json', jobs);
      return NextResponse.json(job, { status: 201 });
    } catch (fsError: any) {
      return NextResponse.json({ 
        error: 'Database not configured properly',
        details: fsError.message 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('POST jobs error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
