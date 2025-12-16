import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { getServerSession } from '@/lib/auth';
import { ALLOWED_JOB_TYPES } from '@/lib/job-types';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ jobs: [] });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ jobs: [] });
    }

    // Get user profile with preferred_job_types
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, tier, preferred_job_types')
      .eq('email', session.user.email)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ jobs: [] });
    }

    // Build query for matched jobs
    let query = supabase
      .from('scraped_jobs')
      .select('*, job_applications!left(id)')
      .eq('profile_id', profile.id)
      .gte('fit_score', 90)
      .eq('is_active', true);

    // Filter by preferred_job_types if specified
    // Empty array means "show all jobs" (no filtering)
    if (Array.isArray(profile.preferred_job_types) && profile.preferred_job_types.length > 0) {
      // Only show jobs where job_type matches one of the preferred types
      query = query.in('job_type', profile.preferred_job_types);
    }

    const { data: jobs, error } = await query
      .order('fit_score', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching matched jobs:', error);
      return NextResponse.json({ jobs: [] });
    }

    // Transform to include applied status and job_type
    const transformedJobs = (jobs || []).map((job: any) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      description: job.description,
      salary: job.salary,
      job_type: job.job_type || null,
      fit_score: job.fit_score,
      match_reasons: job.match_reasons,
      applied: job.job_applications && job.job_applications.length > 0,
    }));

    return NextResponse.json({ jobs: transformedJobs });
  } catch (error: any) {
    console.error('Matched jobs error:', error);
    return NextResponse.json({ jobs: [] });
  }
}
