import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import { createClient } from '@supabase/supabase-js';
import { get30DaysAgoDate } from '@/lib/job-filters';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Admin AI Health API
 * Returns AI matching pipeline health metrics
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
    const today = new Date().toISOString().split('T')[0];

    // Jobs evaluated (all active jobs in last 30 days)
    const { count: jobsEvaluated } = await supabase
      .from('scraped_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .gte('posted_date', thirtyDaysAgo);

    // Jobs passed pre-filter (have profile_id set, meaning they passed hard filters)
    const { count: jobsPassedPreFilter } = await supabase
      .from('scraped_jobs')
      .select('*', { count: 'exact', head: true })
      .not('profile_id', 'is', null)
      .gte('posted_date', thirtyDaysAgo);

    // Jobs passed AI threshold (fit_score >= 70)
    const { count: jobsPassedAIThreshold } = await supabase
      .from('scraped_jobs')
      .select('*', { count: 'exact', head: true })
      .not('profile_id', 'is', null)
      .gte('fit_score', 70)
      .gte('posted_date', thirtyDaysAgo);

    // Get rejection reasons from match_reasons (if available)
    // For now, we'll estimate based on fit_score distribution
    const { data: rejectedJobs } = await supabase
      .from('scraped_jobs')
      .select('fit_score, match_reasons')
      .eq('is_active', true)
      .gte('posted_date', thirtyDaysAgo)
      .or('profile_id.is.null,fit_score.lt.70');

    // Group rejection reasons (simplified - actual reasons would come from match_reasons JSONB)
    const rejectionReasons = {
      locationMismatch: 0,
      jobTypeMismatch: 0,
      skillsLessThan3: 0,
      payMismatch: 0,
      experienceMismatch: 0,
      lowScore: rejectedJobs?.filter(j => j.fit_score !== null && j.fit_score < 70).length || 0,
    };

    // Parse match_reasons if available
    rejectedJobs?.forEach(job => {
      if (job.match_reasons && typeof job.match_reasons === 'object') {
        const reasons = Array.isArray(job.match_reasons) ? job.match_reasons : [];
        reasons.forEach((reason: string) => {
          const reasonLower = reason.toLowerCase();
          if (reasonLower.includes('location')) rejectionReasons.locationMismatch++;
          if (reasonLower.includes('job type') || reasonLower.includes('jobtype')) rejectionReasons.jobTypeMismatch++;
          if (reasonLower.includes('skill') && reasonLower.includes('< 3')) rejectionReasons.skillsLessThan3++;
          if (reasonLower.includes('pay') || reasonLower.includes('rate')) rejectionReasons.payMismatch++;
          if (reasonLower.includes('experience') || reasonLower.includes('exp')) rejectionReasons.experienceMismatch++;
        });
      }
    });

    const jobsEvaluatedCount = jobsEvaluated || 0;
    const jobsPassedPreFilterCount = jobsPassedPreFilter || 0;
    const jobsPassedAIThresholdCount = jobsPassedAIThreshold || 0;

    return NextResponse.json({
      jobsEvaluated: jobsEvaluatedCount,
      jobsPassedPreFilter: jobsPassedPreFilterCount,
      jobsPassedAIThreshold: jobsPassedAIThresholdCount,
      rejectionReasons,
      preFilterPassRate: jobsEvaluatedCount > 0
        ? Math.round((jobsPassedPreFilterCount / jobsEvaluatedCount) * 100)
        : 0,
      aiThresholdPassRate: jobsPassedPreFilterCount > 0
        ? Math.round((jobsPassedAIThresholdCount / jobsPassedPreFilterCount) * 100)
        : 0,
    });
  } catch (error: any) {
    console.error('Admin AI health error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

