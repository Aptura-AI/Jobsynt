/**
 * Deterministic Job Matching API (Ledger-Based)
 * 
 * CORE PRINCIPLE:
 * candidate_job_matches is the SINGLE SOURCE OF TRUTH.
 * Jobs are inserted ONLY ONCE and NEVER re-processed.
 * 
 * POST: Qualify new jobs for a candidate (only NEW jobs)
 * GET: Fetch qualified jobs from the ledger (no reprocessing)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';
import { fetchAndMatchJobs } from '@/lib/matching/getEligibleJobs';
import { get30DaysAgoDate } from '@/lib/job-filters';
import { logJobQualified, logFeedFetch } from '@/lib/matching/jobQualificationLog';
import { rankJobsWithAI, CandidateProfile } from '@/lib/matching/rankJobsWithAI';

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

    // SAFEGUARD: Get existing job IDs to prevent re-insertion
    const { data: existingMatches } = await supabase
      .from('candidate_job_matches')
      .select('job_id')
      .eq('candidate_id', profile.id);
    
    const existingJobIds = new Set((existingMatches || []).map(m => m.job_id));
    console.log(`[Match Jobs] Candidate ${profile.id.substring(0, 8)}... has ${existingJobIds.size} existing qualified jobs`);

    // Fetch and match ONLY NEW jobs (exclude already qualified jobs)
    console.log(`[Match Jobs] Starting matching for candidate: ${profile.email}`);
    console.log(`[Match Jobs] Profile skills: ${(profile.skills || []).join(', ') || 'NONE'}`);
    console.log(`[Match Jobs] Profile primary_skills: ${(profile.primary_skills || []).join(', ') || 'NONE'}`);
    console.log(`[Match Jobs] Profile location: ${profile.location || 'NOT SET'}`);
    
    const matchingResult = await fetchAndMatchJobs(supabase, profile, {
      minScore: 50, // 50 out of 80 points threshold
      logFiltering: true,
    });
    
    console.log(`[Match Jobs] Matching result: ${matchingResult.stats.total} total, ${matchingResult.stats.passedPreFilter} passed pre-filter, ${matchingResult.eligible.length} eligible`);
    
    // Log why jobs were rejected (for debugging)
    if (matchingResult.stats.filteredOut > 0 && matchingResult.rejectionLogs.length > 0) {
      const reasonCounts: Record<string, number> = {};
      matchingResult.rejectionLogs.forEach(log => {
        reasonCounts[log.reason] = (reasonCounts[log.reason] || 0) + 1;
      });
      console.log(`[Match Jobs] Rejection reasons:`, reasonCounts);
    }

    // CRITICAL: Filter out jobs that already exist in candidate_job_matches
    // Jobs are inserted ONCE and NEVER re-processed
    const newEligibleJobs = matchingResult.eligible.filter(job => {
      if (!job.id) return false;
      const isNew = !existingJobIds.has(job.id);
      if (!isNew) {
        console.log(`[Match Jobs] SKIPPED: Job ${job.id.substring(0, 8)}... already qualified for candidate`);
      }
      return isNew;
    });

    console.log(`[Match Jobs] ${newEligibleJobs.length} NEW jobs to qualify (${matchingResult.eligible.length - newEligibleJobs.length} already in ledger)`);

    // Save ONLY NEW eligible jobs to candidate_job_matches
    const matchesToSave = newEligibleJobs.map(job => ({
      candidate_id: profile.id,
      job_id: job.id!,
      match_score: job.match_score,
      match_source: job.match_source || 'global_match',
      qualified_at: new Date().toISOString(),
      reasons: job.score_breakdown ? [
        `Skills: ${job.score_breakdown.skills} points`,
        `Experience: ${job.score_breakdown.experience} points`,
        `Degree/Cert: ${job.score_breakdown.degree} points`,
        `Pay Rate: ${job.score_breakdown.pay} points`,
        job.match_source === 'explicit_target' ? '🎯 Recruiter-targeted' : '',
      ].filter(Boolean) : [],
    }));

    // Insert new jobs (not upsert - jobs should never be updated)
    let insertedCount = 0;
    let skippedCount = 0;

    if (matchesToSave.length > 0) {
      for (const match of matchesToSave) {
        // Double-check: only insert if not exists
        const { data: existing } = await supabase
          .from('candidate_job_matches')
          .select('job_id')
          .eq('candidate_id', match.candidate_id)
          .eq('job_id', match.job_id)
          .maybeSingle();

        if (existing) {
          skippedCount++;
          continue;
        }

        const { error: insertError } = await supabase
          .from('candidate_job_matches')
          .insert(match);

        if (insertError) {
          // Ignore duplicate key errors (race condition protection)
          if (insertError.code === '23505') {
            skippedCount++;
            continue;
          }
          console.error(`[Match Jobs] Insert error:`, insertError);
          continue;
        }

        insertedCount++;

        // Log qualification event
        await logJobQualified(
          match.candidate_id,
          match.job_id,
          match.match_source as 'explicit_target' | 'global_match',
          match.match_score,
          match.match_source === 'explicit_target' 
            ? 'Recruiter explicitly targeted this job' 
            : 'Passed deterministic pre-filter and scoring'
        );
      }
    }

    // Count by source
    const explicitTargets = newEligibleJobs.filter(j => j.match_source === 'explicit_target').length;
    const globalMatches = newEligibleJobs.filter(j => j.match_source === 'global_match').length;

    // ============================================
    // TRIGGER 1: AI RANKING (after job insertion)
    // ============================================
    // If new jobs were inserted, immediately trigger AI ranking
    // This ensures ai_priority is set ASAP
    let rankingTriggered = false;
    let rankingError: string | null = null;
    
    if (insertedCount > 0) {
      console.log(`[Match Jobs] Triggering AI ranking for candidate ${profile.id.substring(0, 8)}... (${insertedCount} new jobs)`);
      
      try {
        // Prepare candidate profile for AI
        const candidateData: CandidateProfile = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          title: profile.title,
          location: profile.location,
          phone: profile.phone,
          skills: profile.skills,
          primary_skills: profile.primary_skills,
          secondary_skills: profile.secondary_skills,
          adjacent_skills: profile.adjacent_skills,
          generic_skills: profile.generic_skills,
          experience_years: profile.experience_years,
          preferred_job_types: profile.preferred_job_types,
          rate_expectation: profile.rate_expectation,
          expected_pay_min: profile.expected_pay_min,
          work_mode: profile.work_mode,
          contract_type: profile.contract_type,
          visa_status: profile.visa_status,
          availability: profile.availability,
          summary: profile.summary,
          resume_text: profile.resume_text,
          degrees: profile.degrees,
          certifications: profile.certifications,
        };

        // Trigger AI ranking asynchronously (fire-and-forget, don't block response)
        // AI ranking will update ai_priority, fit_score, and last_ranked_at
        // This runs AFTER all inserts complete, as required
        (async () => {
          try {
            const rankingResult = await rankJobsWithAI(profile.id, candidateData);
            console.log(`[Match Jobs] AI ranking completed: ${rankingResult.jobs.length} jobs ranked for ${profile.id.substring(0, 8)}...`);
          } catch (err: any) {
            console.error(`[Match Jobs] AI ranking error (non-blocking):`, err.message);
            // Don't throw - ranking failure shouldn't block job insertion
            // Ranking will retry via cron safety net
          }
        })();
        
        rankingTriggered = true;
      } catch (err: any) {
        rankingError = err.message;
        console.error(`[Match Jobs] Failed to trigger AI ranking:`, err);
        // Don't block response - ranking can retry via cron
      }
    }

    // Build diagnostic info
    const diagnostics = {
      totalJobsInDB: matchingResult.stats.total,
      passedPreFilter: matchingResult.stats.passedPreFilter,
      eligibleJobs: matchingResult.eligible.length,
      rejectionBreakdown: {} as Record<string, number>,
    };
    
    // Count rejection reasons
    matchingResult.rejectionLogs.forEach(log => {
      diagnostics.rejectionBreakdown[log.reason] = (diagnostics.rejectionBreakdown[log.reason] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      newJobsQualified: insertedCount,
      alreadyQualified: existingJobIds.size,
      skipped: skippedCount,
      explicitTargets,
      globalMatches,
      stats: matchingResult.stats,
      diagnostics, // Include diagnostic info
      ranking: {
        triggered: rankingTriggered,
        error: rankingError || undefined,
      },
      message: `Qualified ${insertedCount} new jobs (${explicitTargets} targeted, ${globalMatches} global). ${existingJobIds.size} already in ledger.${rankingTriggered ? ' AI ranking triggered.' : ''}`,
    });
  } catch (error: any) {
    console.error('Job matching error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * GET - Fetch Active Feed from Candidate Job Ledger
 * 
 * This returns jobs from candidate_job_matches (the ledger).
 * It does NOT run matching logic.
 * It does NOT call AI.
 * It does NOT modify data.
 * 
 * Query: Jobs that are:
 * - Not applied
 * - Not dismissed  
 * - Posted within 30 days
 */
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

    // Calculate 30 days ago
    const thirtyDaysAgo = get30DaysAgoDate();

    // LEDGER QUERY: Fetch from candidate_job_matches
    // NO reprocessing, NO AI, NO modification
    // NOTE: We fetch ALL matches first, then filter by date client-side
    // This is because .gte() on posted_date excludes jobs where posted_date is NULL
    // NOTE: We do NOT use .is(column, null) filters as they silently exclude rows
    // Instead, we fetch all rows and filter in-memory
    const { data: rawMatches, error: matchesError } = await supabase
      .from('candidate_job_matches')
      .select(`
        job_id,
        match_score,
        match_source,
        qualified_at,
        ai_priority,
        reasons,
        applied_at,
        dismissed_at,
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
      .eq('candidate_id', profile.id);
    
    // Filter by applied/dismissed and date CLIENT-SIDE to handle NULL values properly
    // NULL posted_date = treat as recent (job was just uploaded without date)
    const matches = (rawMatches || []).filter((match: any) => {
      // Skip applied jobs
      if (match.applied_at) return false;

      // Skip dismissed jobs
      if (match.dismissed_at) return false;

      const job = match.scraped_jobs;
      if (!job) return false;

      // Treat NULL posted_date as recent
      if (!job.posted_date) {
        console.log(`[Active Feed] Job ${job.id?.substring(0, 8)} has NULL posted_date - including as recent`);
        return true;
      }

      // Check if within 30 days
      return job.posted_date >= thirtyDaysAgo;
    });

    if (matchesError) {
      console.error('[Active Feed] Query error:', matchesError);
      return NextResponse.json({ jobs: [] });
    }

    // Sort by: explicit_target first, then ai_priority, then fit_score, then qualified_at
    const sortedMatches = (matches || []).sort((a: any, b: any) => {
      // 1. Explicit targets first
      if (a.match_source === 'explicit_target' && b.match_source !== 'explicit_target') return -1;
      if (b.match_source === 'explicit_target' && a.match_source !== 'explicit_target') return 1;
      
      // 2. AI priority (High > Medium > Low > null)
      const priorityOrder: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
      const aPriority = priorityOrder[a.ai_priority] || 0;
      const bPriority = priorityOrder[b.ai_priority] || 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      // 3. Fit score
      if ((b.match_score || 0) !== (a.match_score || 0)) {
        return (b.match_score || 0) - (a.match_score || 0);
      }
      
      // 4. Qualified at (newest first)
      return new Date(b.qualified_at || 0).getTime() - new Date(a.qualified_at || 0).getTime();
    });

    // Transform to job format
    const jobs = sortedMatches.map((match: any) => {
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
        ai_priority: match.ai_priority,
        qualified_at: match.qualified_at,
        match_reasons: match.reasons || [],
        is_recruiter_targeted: match.match_source === 'explicit_target',
      };
    });

    // Log feed fetch
    logFeedFetch(profile.id, jobs.length, 'active');

    // Update view tracking for returned jobs
    if (jobs.length > 0) {
      const jobIds = jobs.map((j: any) => j.id);
      const now = new Date().toISOString();
      
      // Update last_seen_at for all jobs
      await supabase
        .from('candidate_job_matches')
        .update({ last_seen_at: now })
        .eq('candidate_id', profile.id)
        .in('job_id', jobIds);
      
      // Set first_seen_at for jobs that haven't been seen before
      await supabase
        .from('candidate_job_matches')
        .update({ first_seen_at: now })
        .eq('candidate_id', profile.id)
        .in('job_id', jobIds)
        .is('first_seen_at', null);
    }

    return NextResponse.json({ 
      jobs,
      total: jobs.length,
      message: jobs.length > 0 
        ? `${jobs.length} qualified jobs in your feed` 
        : 'No active jobs in feed. New matches will appear as they are qualified.',
    });
  } catch (error: any) {
    console.error('[Active Feed] Error:', error);
    return NextResponse.json({ jobs: [] });
  }
}
