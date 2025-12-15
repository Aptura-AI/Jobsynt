import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { getServerSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ jobs: [] });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ jobs: [] });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, tier')
      .eq('email', session.user.email)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ jobs: [] });
    }

    // Get matched jobs from scraped_jobs (90%+ match preferred)
    const { data: jobs, error } = await supabase
      .from('scraped_jobs')
      .select('*, job_applications!left(id)')
      .eq('profile_id', profile.id)
      .gte('fit_score', 90)
      .eq('is_active', true)
      .order('fit_score', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching matched jobs:', error);
      return NextResponse.json({ jobs: [] });
    }

    // Transform to include applied status
    const transformedJobs = (jobs || []).map((job: any) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      description: job.description,
      salary: job.salary,
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
