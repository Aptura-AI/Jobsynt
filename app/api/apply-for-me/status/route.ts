import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * GET /api/apply-for-me/status
 * 
 * Returns application runs for the current candidate.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get candidate profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', session.user.email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ runs: [] });
    }

    // Fetch application runs
    const { data: runs, error: runsError } = await supabase
      .from('job_application_runs')
      .select('id, job_id, job_url, status, error, applied_at, created_at, intervention_reason, intervention_message')
      .eq('candidate_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (runsError) {
      console.error('[Application Status] Error:', runsError);
      return NextResponse.json({ runs: [] });
    }

    // Fetch job details for each run
    const jobIds = runs?.map(r => r.job_id).filter(Boolean) || [];
    let jobs: any[] = [];
    
    if (jobIds.length > 0) {
      const { data: jobsData } = await supabase
        .from('scraped_jobs')
        .select('id, title, company')
        .in('id', jobIds);
      
      jobs = jobsData || [];
    }

    // Merge job details with runs
    const runsWithJobs = (runs || []).map(run => ({
      ...run,
      job: jobs.find(j => j.id === run.job_id),
    }));

    return NextResponse.json({ runs: runsWithJobs });
  } catch (error: any) {
    console.error('[Application Status] Error:', error);
    return NextResponse.json({ runs: [] });
  }
}

