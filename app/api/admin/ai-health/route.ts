import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import { createClient } from '@supabase/supabase-js';
import { get30DaysAgoDate } from '@/lib/job-filters';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin AI Health API
 * Returns AI matching pipeline health metrics using candidate_job_matches
 */
export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication
    const cookieStore = cookies();
    const rawToken = cookieStore.get('jobsynth_token')?.value;

    if (!rawToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = verifyToken(rawToken);
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const thirtyDaysAgo = get30DaysAgoDate();

    // Total jobs available (all active jobs in last 30 days)
    const { count: totalJobs } = await supabase
      .from('scraped_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .gte('posted_date', thirtyDaysAgo);

    // Total candidates with profiles
    const { count: totalCandidates } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'candidate');

    // Jobs that passed pre-filter (in candidate_job_matches)
    const { count: jobsInMatches } = await supabase
      .from('candidate_job_matches')
      .select('job_id', { count: 'exact', head: true });

    // Unique jobs that have been matched to at least one candidate
    const { data: uniqueMatchedJobs } = await supabase
      .from('candidate_job_matches')
      .select('job_id')
      .limit(1000);
    
    const uniqueJobsMatched = new Set(uniqueMatchedJobs?.map(m => m.job_id) || []).size;

    // Jobs with high scores (≥70%)
    const { count: highScoreMatches } = await supabase
      .from('candidate_job_matches')
      .select('*', { count: 'exact', head: true })
      .gte('match_score', 70);

    // Active matches (not dismissed/expired)
    const { count: activeMatches } = await supabase
      .from('candidate_job_matches')
      .select('*', { count: 'exact', head: true })
      .eq('job_status', 'active');

    // Average match score
    const { data: matchScores } = await supabase
      .from('candidate_job_matches')
      .select('match_score')
      .limit(1000);
    
    const avgScore = matchScores && matchScores.length > 0
      ? Math.round(matchScores.reduce((sum, m) => sum + (m.match_score || 0), 0) / matchScores.length)
      : 0;

    // Calculate pass rates
    const totalJobsCount = totalJobs || 0;
    const uniqueJobsMatchedCount = uniqueJobsMatched || 0;
    const highScoreMatchesCount = highScoreMatches || 0;
    const totalMatchesCount = jobsInMatches || 0;

    const preFilterPassRate = totalJobsCount > 0
      ? Math.round((uniqueJobsMatchedCount / totalJobsCount) * 100)
      : 0;

    const aiThresholdPassRate = totalMatchesCount > 0
      ? Math.round((highScoreMatchesCount / totalMatchesCount) * 100)
      : 0;

    // Estimate rejection reasons based on match scores
    const rejectionReasons = {
      locationMismatch: 0,
      jobTypeMismatch: 0,
      visaBlock: 0,
      skillsBelowThreshold: 0,
      experienceMismatch: 0,
      lowScore: 0,
    };

    // Get low score matches for analysis
    const { data: lowScoreMatches } = await supabase
      .from('candidate_job_matches')
      .select('match_score, reasons')
      .lt('match_score', 70)
      .limit(100);

    if (lowScoreMatches) {
      rejectionReasons.lowScore = lowScoreMatches.length;
      
      // Parse reasons if available
      lowScoreMatches.forEach(match => {
        if (match.reasons && Array.isArray(match.reasons)) {
          match.reasons.forEach((reason: string) => {
            const reasonLower = (reason || '').toLowerCase();
            if (reasonLower.includes('location')) rejectionReasons.locationMismatch++;
            if (reasonLower.includes('job type') || reasonLower.includes('jobtype')) rejectionReasons.jobTypeMismatch++;
            if (reasonLower.includes('visa')) rejectionReasons.visaBlock++;
            if (reasonLower.includes('skill')) rejectionReasons.skillsBelowThreshold++;
            if (reasonLower.includes('experience') || reasonLower.includes('exp')) rejectionReasons.experienceMismatch++;
          });
        }
      });
    }

    return NextResponse.json({
      // Overview
      totalJobs: totalJobsCount,
      totalCandidates: totalCandidates || 0,
      
      // Matching stats
      uniqueJobsMatched: uniqueJobsMatchedCount,
      totalMatches: totalMatchesCount,
      activeMatches: activeMatches || 0,
      highScoreMatches: highScoreMatchesCount,
      
      // Rates
      preFilterPassRate,
      aiThresholdPassRate,
      averageMatchScore: avgScore,
      
      // Rejection analysis
      rejectionReasons,
      
      // Health indicators
      healthStatus: preFilterPassRate >= 30 ? 'healthy' : preFilterPassRate >= 10 ? 'warning' : 'critical',
      healthMessage: preFilterPassRate >= 30 
        ? `${preFilterPassRate}% of jobs are being matched - system is healthy`
        : preFilterPassRate >= 10
        ? `Only ${preFilterPassRate}% of jobs are being matched - review filter settings`
        : `Only ${preFilterPassRate}% of jobs are being matched - pre-filter may be too strict`,
    });
  } catch (error: any) {
    console.error('Admin AI health error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
