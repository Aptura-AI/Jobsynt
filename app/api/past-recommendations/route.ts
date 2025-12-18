/**
 * Past Recommendations API (Ledger-Based)
 * 
 * This endpoint returns ALL previously qualified jobs for a candidate.
 * It is a simple ledger query - NO AI, NO matching, NO modification.
 * 
 * CRITICAL RULES:
 * - MUST NOT call AI
 * - MUST NOT run matching
 * - MUST NOT modify data
 * - MUST NOT exclude jobs shown earlier
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';
import { get30DaysAgoDate } from '@/lib/job-filters';
import { logFeedFetch } from '@/lib/matching/jobQualificationLog';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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
      return NextResponse.json({ jobs: [], total: 0 });
    }

    // Get query params for filtering
    const url = new URL(req.url);
    const includeApplied = url.searchParams.get('include_applied') === 'true';
    const includeDismissed = url.searchParams.get('include_dismissed') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    // Calculate 30 days ago
    const thirtyDaysAgo = get30DaysAgoDate();

    // Build query - simple ledger read
    let query = supabase
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
      .gte('scraped_jobs.posted_date', thirtyDaysAgo)
      .order('qualified_at', { ascending: false })
      .limit(limit);

    // Apply filters based on query params
    if (!includeApplied) {
      query = query.is('applied_at', null);
    }
    if (!includeDismissed) {
      query = query.is('dismissed_at', null);
    }

    const { data: matches, error: matchesError } = await query;

    if (matchesError) {
      console.error('[Past Recommendations] Query error:', matchesError);
      return NextResponse.json({ jobs: [], total: 0 });
    }

    // Transform to job format - NO filtering, NO processing
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
        match_source: match.match_source,
        qualified_at: match.qualified_at,
        applied_at: match.applied_at,
        dismissed_at: match.dismissed_at,
        ai_priority: match.ai_priority,
        match_reasons: match.reasons || [],
        is_recruiter_targeted: match.match_source === 'explicit_target',
        status: match.applied_at 
          ? 'applied' 
          : match.dismissed_at 
            ? 'dismissed' 
            : 'active',
      };
    });

    // Log past recommendations fetch
    logFeedFetch(profile.id, jobs.length, 'past');

    return NextResponse.json({ 
      jobs,
      total: jobs.length,
      filters: {
        includeApplied,
        includeDismissed,
        limit,
      },
      message: `${jobs.length} jobs in your recommendation history`,
    });
  } catch (error: any) {
    console.error('[Past Recommendations] Error:', error);
    return NextResponse.json({ jobs: [], total: 0 });
  }
}

