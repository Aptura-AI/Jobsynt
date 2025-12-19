/**
 * Debug endpoint to check a specific candidate's job matches
 * GET /api/debug/candidate-jobs?id=6c697a80-5b01-43c1-ba3e-e0085295164e
 * 
 * Enhanced to show visibility analysis including platform gating and ai_visibility
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { get30DaysAgoDate } from '@/lib/job-filters';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(req: NextRequest) {
  try {
    const candidateId = req.nextUrl.searchParams.get('id');
    
    if (!candidateId) {
      return NextResponse.json({ error: 'Missing candidate id parameter' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const thirtyDaysAgo = get30DaysAgoDate();

    // Step 1: Get all matches for this candidate
    const { data: allMatches, error: matchError } = await supabase
      .from('candidate_job_matches')
      .select('*')
      .eq('candidate_id', candidateId);

    // Step 2: Get the scraped_jobs for these job_ids
    const jobIds = (allMatches || []).map(m => m.job_id);
    
    let scrapedJobs: any[] = [];
    if (jobIds.length > 0) {
      const { data: jobs } = await supabase
        .from('scraped_jobs')
        .select('*')
        .in('id', jobIds);
      scrapedJobs = jobs || [];
    }

    // Step 3: Try the exact query from the dashboard (WITHOUT date filter)
    const { data: dashboardMatches, error: dashboardError } = await supabase
      .from('candidate_job_matches')
      .select(`
        job_id,
        match_score,
        match_source,
        qualified_at,
        applied_at,
        dismissed_at,
        ai_priority,
        reasons,
        scraped_jobs!inner (
          id,
          title,
          company,
          location,
          posted_date,
          is_active
        )
      `)
      .eq('candidate_id', candidateId)
      .is('applied_at', null)
      .is('dismissed_at', null);

    // Step 4: Check if scraped_jobs exist for all job_ids
    const missingJobs: string[] = [];
    for (const match of allMatches || []) {
      const found = scrapedJobs.find(j => j.id === match.job_id);
      if (!found) {
        missingJobs.push(match.job_id);
      }
    }

    return NextResponse.json({
      candidate_id: candidateId,
      thirtyDaysAgo,
      
      step1_all_matches_in_ledger: {
        count: allMatches?.length || 0,
        matches: allMatches?.map(m => ({
          job_id: m.job_id,
          match_score: m.match_score,
          applied_at: m.applied_at,
          dismissed_at: m.dismissed_at,
          qualified_at: m.qualified_at,
        })),
        error: matchError?.message,
      },
      
      step2_scraped_jobs_for_matches: {
        count: scrapedJobs.length,
        jobs: scrapedJobs.map(j => ({
          id: j.id,
          title: j.title,
          company: j.company,
          posted_date: j.posted_date,
          is_active: j.is_active,
        })),
      },
      
      step3_dashboard_query_result: {
        count: dashboardMatches?.length || 0,
        matches: dashboardMatches?.map((m: any) => ({
          job_id: m.job_id,
          match_score: m.match_score,
          job_title: m.scraped_jobs?.title,
          job_company: m.scraped_jobs?.company,
          posted_date: m.scraped_jobs?.posted_date,
        })),
        error: dashboardError?.message,
      },
      
      step4_missing_jobs: {
        count: missingJobs.length,
        job_ids: missingJobs,
        explanation: missingJobs.length > 0 
          ? 'These job_ids exist in candidate_job_matches but NOT in scraped_jobs table!'
          : 'All jobs exist in both tables',
      },
      
      diagnosis: {
        matches_in_ledger: allMatches?.length || 0,
        jobs_in_scraped_jobs: scrapedJobs.length,
        dashboard_would_show: dashboardMatches?.length || 0,
        missing_from_scraped_jobs: missingJobs.length,
        likely_issue: 
          missingJobs.length > 0
            ? 'CRITICAL: Jobs exist in candidate_job_matches but were DELETED from scraped_jobs!'
            : dashboardError
            ? `Query error: ${dashboardError.message}`
            : (dashboardMatches?.length || 0) === 0 && (allMatches?.length || 0) > 0
            ? 'Jobs filtered out - check applied_at, dismissed_at, or join issue'
            : 'No obvious issue found',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

