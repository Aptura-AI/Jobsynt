/**
 * Admin KPI API - Ledger-Driven Metrics
 * 
 * All metrics come from ledger tables ONLY.
 * No recomputation. No AI inference.
 * 
 * Categories:
 * - Candidate Engagement
 * - Job Flow Health
 * - AI Effectiveness
 * - Email Performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Add admin role check here
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate date boundaries
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ============================================
    // CANDIDATE ENGAGEMENT
    // ============================================
    
    // Total candidates
    const { count: totalCandidates } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'candidate');

    // Candidates with ≥1 qualified job
    const { data: candidatesWithJobs } = await supabase
      .from('candidate_job_matches')
      .select('candidate_id')
      .limit(10000);
    const uniqueCandidatesWithJobs = new Set((candidatesWithJobs || []).map(m => m.candidate_id)).size;

    // Candidates with ≥1 active job
    const { data: candidatesWithActiveJobs } = await supabase
      .from('candidate_job_matches')
      .select('candidate_id')
      .is('applied_at', null)
      .is('dismissed_at', null)
      .limit(10000);
    const uniqueCandidatesWithActiveJobs = new Set((candidatesWithActiveJobs || []).map(m => m.candidate_id)).size;

    // Candidates inactive >7 days (no last_seen_at in 7 days)
    const { data: inactiveCandidates } = await supabase
      .from('candidate_job_matches')
      .select('candidate_id, last_seen_at')
      .or(`last_seen_at.is.null,last_seen_at.lt.${sevenDaysAgo.toISOString()}`)
      .limit(10000);
    const uniqueInactiveCandidates = new Set((inactiveCandidates || []).map(m => m.candidate_id)).size;

    // ============================================
    // JOB FLOW HEALTH
    // ============================================

    // Total jobs ingested
    const { count: totalJobsIngested } = await supabase
      .from('scraped_jobs')
      .select('id', { count: 'exact', head: true });

    // Jobs explicitly targeted
    const { count: jobsExplicitlyTargeted } = await supabase
      .from('candidate_job_matches')
      .select('id', { count: 'exact', head: true })
      .eq('match_source', 'explicit_target');

    // Jobs matched globally
    const { count: jobsMatchedGlobally } = await supabase
      .from('candidate_job_matches')
      .select('id', { count: 'exact', head: true })
      .eq('match_source', 'global_match');

    // Jobs expired without being seen
    const { count: jobsExpiredUnseen } = await supabase
      .from('candidate_job_matches')
      .select('id', { count: 'exact', head: true })
      .lt('qualified_at', thirtyDaysAgo.toISOString())
      .is('first_seen_at', null);

    // Jobs applied
    const { count: jobsApplied } = await supabase
      .from('candidate_job_matches')
      .select('id', { count: 'exact', head: true })
      .not('applied_at', 'is', null);

    // Jobs dismissed
    const { count: jobsDismissed } = await supabase
      .from('candidate_job_matches')
      .select('id', { count: 'exact', head: true })
      .not('dismissed_at', 'is', null);

    // ============================================
    // AI EFFECTIVENESS
    // ============================================

    // Average fit_score of active jobs
    const { data: activeJobScores } = await supabase
      .from('candidate_job_matches')
      .select('match_score')
      .is('applied_at', null)
      .is('dismissed_at', null)
      .limit(10000);
    
    const avgFitScore = activeJobScores && activeJobScores.length > 0
      ? Math.round(activeJobScores.reduce((sum, j) => sum + (j.match_score || 0), 0) / activeJobScores.length)
      : 0;

    // AI priority distribution
    const { count: highPriorityCount } = await supabase
      .from('candidate_job_matches')
      .select('id', { count: 'exact', head: true })
      .eq('ai_priority', 'High');

    const { count: mediumPriorityCount } = await supabase
      .from('candidate_job_matches')
      .select('id', { count: 'exact', head: true })
      .eq('ai_priority', 'Medium');

    const { count: lowPriorityCount } = await supabase
      .from('candidate_job_matches')
      .select('id', { count: 'exact', head: true })
      .eq('ai_priority', 'Low');

    // High-priority jobs applied within 7 days
    const { data: highPriorityApplied } = await supabase
      .from('candidate_job_matches')
      .select('qualified_at, applied_at')
      .eq('ai_priority', 'High')
      .not('applied_at', 'is', null)
      .limit(1000);

    const highPriorityApplied7d = (highPriorityApplied || []).filter(j => {
      if (!j.qualified_at || !j.applied_at) return false;
      const qualified = new Date(j.qualified_at);
      const applied = new Date(j.applied_at);
      return (applied.getTime() - qualified.getTime()) <= 7 * 24 * 60 * 60 * 1000;
    }).length;

    const pctHighPriorityApplied7d = (highPriorityCount || 0) > 0
      ? Math.round((highPriorityApplied7d / (highPriorityCount || 1)) * 100)
      : 0;

    // Avg time from qualification to application (in hours)
    const { data: appliedJobs } = await supabase
      .from('candidate_job_matches')
      .select('qualified_at, applied_at')
      .not('applied_at', 'is', null)
      .not('qualified_at', 'is', null)
      .limit(1000);

    let avgQualToApplyHours = 0;
    if (appliedJobs && appliedJobs.length > 0) {
      const totalHours = appliedJobs.reduce((sum, j) => {
        const qualified = new Date(j.qualified_at!);
        const applied = new Date(j.applied_at!);
        return sum + (applied.getTime() - qualified.getTime()) / (1000 * 60 * 60);
      }, 0);
      avgQualToApplyHours = Math.round(totalHours / appliedJobs.length);
    }

    // ============================================
    // EMAIL PERFORMANCE
    // ============================================

    // Emails sent/opened in last 24h
    const { count: emailsSent24h } = await supabase
      .from('email_events')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', twentyFourHoursAgo.toISOString());

    const { count: emailsOpened24h } = await supabase
      .from('email_events')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', twentyFourHoursAgo.toISOString())
      .not('opened_at', 'is', null);

    // Emails sent/opened in last 7d
    const { count: emailsSent7d } = await supabase
      .from('email_events')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', sevenDaysAgo.toISOString());

    const { count: emailsOpened7d } = await supabase
      .from('email_events')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', sevenDaysAgo.toISOString())
      .not('opened_at', 'is', null);

    // Emails sent/opened in last 30d
    const { count: emailsSent30d } = await supabase
      .from('email_events')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', thirtyDaysAgo.toISOString());

    const { count: emailsOpened30d } = await supabase
      .from('email_events')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', thirtyDaysAgo.toISOString())
      .not('opened_at', 'is', null);

    // Open rates
    const openRate24h = (emailsSent24h || 0) > 0 
      ? Math.round(((emailsOpened24h || 0) / (emailsSent24h || 1)) * 100)
      : 0;
    const openRate7d = (emailsSent7d || 0) > 0 
      ? Math.round(((emailsOpened7d || 0) / (emailsSent7d || 1)) * 100)
      : 0;
    const openRate30d = (emailsSent30d || 0) > 0 
      ? Math.round(((emailsOpened30d || 0) / (emailsSent30d || 1)) * 100)
      : 0;

    // ============================================
    // COMPILE RESPONSE
    // ============================================

    const kpis = {
      candidateEngagement: {
        totalCandidates: totalCandidates || 0,
        candidatesWithQualifiedJobs: uniqueCandidatesWithJobs,
        candidatesWithActiveJobs: uniqueCandidatesWithActiveJobs,
        candidatesInactive7d: uniqueInactiveCandidates,
      },
      jobFlowHealth: {
        totalJobsIngested: totalJobsIngested || 0,
        jobsExplicitlyTargeted: jobsExplicitlyTargeted || 0,
        jobsMatchedGlobally: jobsMatchedGlobally || 0,
        jobsExpiredUnseen: jobsExpiredUnseen || 0,
        jobsApplied: jobsApplied || 0,
        jobsDismissed: jobsDismissed || 0,
        applyToDismissRatio: (jobsDismissed || 0) > 0 
          ? ((jobsApplied || 0) / (jobsDismissed || 1)).toFixed(2)
          : 'N/A',
      },
      aiEffectiveness: {
        avgFitScore,
        priorityDistribution: {
          high: highPriorityCount || 0,
          medium: mediumPriorityCount || 0,
          low: lowPriorityCount || 0,
        },
        pctHighPriorityApplied7d,
        avgQualificationToApplyHours: avgQualToApplyHours,
      },
      emailPerformance: {
        last24h: {
          sent: emailsSent24h || 0,
          opened: emailsOpened24h || 0,
          openRate: `${openRate24h}%`,
        },
        last7d: {
          sent: emailsSent7d || 0,
          opened: emailsOpened7d || 0,
          openRate: `${openRate7d}%`,
        },
        last30d: {
          sent: emailsSent30d || 0,
          opened: emailsOpened30d || 0,
          openRate: `${openRate30d}%`,
        },
      },
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(kpis);
  } catch (error: any) {
    console.error('[Admin KPI] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * POST - Snapshot current KPIs to admin_kpi_snapshots table
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First get current KPIs
    const kpiResponse = await GET(req);
    const kpis = await kpiResponse.json();

    if (kpis.error) {
      return NextResponse.json({ error: kpis.error }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Save snapshot
    const { error: insertError } = await supabase
      .from('admin_kpi_snapshots')
      .upsert({
        snapshot_date: new Date().toISOString().split('T')[0],
        total_candidates: kpis.candidateEngagement.totalCandidates,
        candidates_with_qualified_jobs: kpis.candidateEngagement.candidatesWithQualifiedJobs,
        candidates_with_active_jobs: kpis.candidateEngagement.candidatesWithActiveJobs,
        candidates_inactive_7d: kpis.candidateEngagement.candidatesInactive7d,
        total_jobs_ingested: kpis.jobFlowHealth.totalJobsIngested,
        jobs_explicitly_targeted: kpis.jobFlowHealth.jobsExplicitlyTargeted,
        jobs_matched_globally: kpis.jobFlowHealth.jobsMatchedGlobally,
        jobs_expired_unseen: kpis.jobFlowHealth.jobsExpiredUnseen,
        jobs_applied: kpis.jobFlowHealth.jobsApplied,
        jobs_dismissed: kpis.jobFlowHealth.jobsDismissed,
        avg_fit_score: kpis.aiEffectiveness.avgFitScore,
        high_priority_count: kpis.aiEffectiveness.priorityDistribution.high,
        medium_priority_count: kpis.aiEffectiveness.priorityDistribution.medium,
        low_priority_count: kpis.aiEffectiveness.priorityDistribution.low,
        high_priority_applied_7d: kpis.aiEffectiveness.pctHighPriorityApplied7d,
        avg_qualification_to_apply_hours: kpis.aiEffectiveness.avgQualificationToApplyHours,
        emails_sent_24h: kpis.emailPerformance.last24h.sent,
        emails_opened_24h: kpis.emailPerformance.last24h.opened,
        emails_sent_7d: kpis.emailPerformance.last7d.sent,
        emails_opened_7d: kpis.emailPerformance.last7d.opened,
      }, { onConflict: 'snapshot_date' });

    if (insertError) {
      console.error('[Admin KPI] Snapshot error:', insertError);
      return NextResponse.json({ 
        error: 'Failed to save snapshot',
        details: insertError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'KPI snapshot saved',
      snapshot_date: new Date().toISOString().split('T')[0],
    });
  } catch (error: any) {
    console.error('[Admin KPI] Snapshot error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

