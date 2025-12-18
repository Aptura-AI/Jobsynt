/**
 * Debug Endpoint - Job Matching Diagnostics
 * 
 * This endpoint helps diagnose why jobs are not being matched.
 * DO NOT USE IN PRODUCTION - FOR DEBUGGING ONLY
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic to avoid static generation issues
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get 30 days ago date
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString().split('T')[0];

    // 1. Count total jobs in scraped_jobs
    const { count: totalJobs } = await supabase
      .from('scraped_jobs')
      .select('*', { count: 'exact', head: true });

    // 2. Count jobs where is_active is true
    const { count: activeJobs } = await supabase
      .from('scraped_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // 3. Count jobs where is_active is NULL
    const { count: nullActiveJobs } = await supabase
      .from('scraped_jobs')
      .select('*', { count: 'exact', head: true })
      .is('is_active', null);

    // 4. Count jobs where is_active is false
    const { count: inactiveJobs } = await supabase
      .from('scraped_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', false);

    // 5. Count jobs from last 30 days
    const { count: recentJobs } = await supabase
      .from('scraped_jobs')
      .select('*', { count: 'exact', head: true })
      .gte('posted_date', thirtyDaysAgoISO);

    // 6. Count jobs with posted_date NULL
    const { count: nullPostedDateJobs } = await supabase
      .from('scraped_jobs')
      .select('*', { count: 'exact', head: true })
      .is('posted_date', null);

    // 7. Get sample jobs for inspection
    const { data: sampleJobs } = await supabase
      .from('scraped_jobs')
      .select('id, title, company, location, posted_date, is_active, job_type, skills, required_skills')
      .order('created_at', { ascending: false })
      .limit(5);

    // 8. Count total candidates with profiles
    const { count: totalCandidates } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // 9. Count entries in candidate_job_matches
    const { count: totalMatches } = await supabase
      .from('candidate_job_matches')
      .select('*', { count: 'exact', head: true });

    // 10. Get sample candidate profile
    const { data: sampleProfile } = await supabase
      .from('profiles')
      .select('id, full_name, location, skills, primary_skills, job_type, visa')
      .limit(1)
      .single();

    // 11. Which filter would these jobs pass?
    // Check the actual query we use for matching
    const { data: matchableJobs, error: queryError } = await supabase
      .from('scraped_jobs')
      .select('id, title, is_active, posted_date')
      .or('is_active.is.null,is_active.eq.true')
      .gte('posted_date', thirtyDaysAgoISO)
      .order('posted_date', { ascending: false })
      .limit(10);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      diagnostics: {
        scraped_jobs: {
          total: totalJobs,
          is_active_true: activeJobs,
          is_active_null: nullActiveJobs,
          is_active_false: inactiveJobs,
          recent_30_days: recentJobs,
          posted_date_null: nullPostedDateJobs,
          sample_jobs: sampleJobs?.map(j => ({
            id: j.id?.substring(0, 8),
            title: j.title,
            company: j.company,
            posted_date: j.posted_date,
            is_active: j.is_active,
            job_type: j.job_type,
            has_skills: !!(j.skills || j.required_skills),
          })),
        },
        candidates: {
          total: totalCandidates,
          sample_profile: sampleProfile ? {
            id: sampleProfile.id?.substring(0, 8),
            name: sampleProfile.full_name,
            location: sampleProfile.location,
            job_type: sampleProfile.job_type,
            visa: sampleProfile.visa,
            has_skills: !!(sampleProfile.skills?.length || sampleProfile.primary_skills?.length),
          } : null,
        },
        matches: {
          total: totalMatches,
        },
        matching_query: {
          matchable_jobs_count: matchableJobs?.length,
          query_error: queryError?.message,
          sample_matchable: matchableJobs?.map(j => ({
            id: j.id?.substring(0, 8),
            title: j.title,
            is_active: j.is_active,
            posted_date: j.posted_date,
          })),
        },
        issues_detected: [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Diagnostic failed',
      message: error.message,
    }, { status: 500 });
  }
}

