/**
 * Deterministic Job Matching API
 * 
 * This endpoint performs deterministic matching and saves results to candidate_job_matches.
 * Only jobs with score ≥70% are saved.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';
import { fetchAndMatchJobs } from '@/lib/matching/getEligibleJobs';
import { get30DaysAgoDate } from '@/lib/job-filters';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
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
      .select('*')
      .eq('email', session.user.email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Fetch and match jobs
    const matchingResult = await fetchAndMatchJobs(supabase, profile, {
      minScore: 70,
      logFiltering: true,
    });

    // Save eligible jobs to candidate_job_matches
    const matchesToSave = matchingResult.eligible.map(job => ({
      candidate_id: profile.id,
      job_id: job.id!,
      match_score: job.match_score,
      match_source: job.match_source || 'global_match', // Track explicit vs global
      reasons: job.score_breakdown ? [
        `Skills: ${job.score_breakdown.skills} points`,
        `Job Title: ${job.score_breakdown.jobTitle} points`,
        `Experience: ${job.score_breakdown.experience} points`,
        `Degree/Cert: ${job.score_breakdown.degree} points`,
        `Pay Rate: ${job.score_breakdown.pay} points`,
        job.match_source === 'explicit_target' ? '🎯 Recruiter-targeted' : '',
      ].filter(Boolean) : [],
    }));

    // Use upsert to avoid duplicates (UNIQUE constraint on candidate_id, job_id)
    if (matchesToSave.length > 0) {
      const { error: saveError } = await supabase
        .from('candidate_job_matches')
        .upsert(matchesToSave, { onConflict: 'candidate_id,job_id' });

      if (saveError) {
        console.error('Error saving job matches:', saveError);
        return NextResponse.json({ 
          error: 'Failed to save matches', 
          details: saveError.message 
        }, { status: 500 });
      }
    }

    // Count explicit targets
    const explicitTargets = matchingResult.eligible.filter(j => j.match_source === 'explicit_target').length;
    const globalMatches = matchingResult.eligible.filter(j => j.match_source === 'global_match').length;

    return NextResponse.json({
      success: true,
      matchesFound: matchingResult.eligible.length,
      explicitTargets,
      globalMatches,
      stats: matchingResult.stats,
      message: `Found ${matchingResult.eligible.length} matching jobs (${explicitTargets} targeted, ${globalMatches} global)`,
    });
  } catch (error: any) {
    console.error('Job matching error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

// GET - Fetch matched jobs for candidate
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
      return NextResponse.json({ jobs: [] });
    }

    // Fetch matched jobs from candidate_job_matches
    // Only fetch active jobs (exclude applied, dismissed, expired)
    const thirtyDaysAgo = get30DaysAgoDate();
    const { data: matches, error: matchesError } = await supabase
      .from('candidate_job_matches')
      .select(`
        match_score,
        reasons,
        created_at,
        job_status,
        scraped_jobs (
          id,
          title,
          company,
          location,
          job_type,
          location_type,
          is_remote,
          url,
          salary,
          pay_rate_min,
          pay_rate_max,
          description,
          posted_date,
          is_active
        )
      `)
      .eq('candidate_id', profile.id)
      .eq('job_status', 'active') // Only active jobs
      .gte('scraped_jobs.posted_date', thirtyDaysAgo) // Only jobs from last 30 days
      .eq('scraped_jobs.is_active', true) // Only active jobs
      .order('match_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return NextResponse.json({ jobs: [] });
    }

    // Transform to job format
    const jobs = (matches || []).map((match: any) => {
      const job = match.scraped_jobs;
      return {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        job_type: job.job_type,
        location_type: job.location_type,
        is_remote: job.is_remote,
        url: job.url,
        salary: job.salary,
        pay_rate_min: job.pay_rate_min,
        pay_rate_max: job.pay_rate_max,
        description: job.description,
        posted_date: job.posted_date,
        fit_score: match.match_score,
        match_reasons: match.reasons || [],
      };
    });

    return NextResponse.json({ jobs });
  } catch (error: any) {
    console.error('Error fetching matched jobs:', error);
    return NextResponse.json({ jobs: [] });
  }
}

