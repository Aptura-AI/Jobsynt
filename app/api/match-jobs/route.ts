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
import { applyPlatformGating } from '@/lib/matching/platformGating';
import {
  fetchCandidateMatches,
  applyVisibilityRules,
  fetchJobsByIds,
  mergeMatchesWithJobs,
  sortJobsByPriority,
  buildDashboardResponse,
} from '@/lib/matching/dashboardHelpers';

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
      ai_visibility: 'visible', // Default to visible, platform gating will update if needed
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

    // ============================================
    // PLATFORM GATING (after job insertion)
    // ============================================
    // Apply deterministic platform gating to newly inserted jobs
    // This prevents cross-platform recommendations (e.g., PeopleSoft + Oracle Fusion)
    let platformConflictsHidden = 0;
    
    if (insertedCount > 0) {
      // Fetch job platforms for newly inserted jobs
      const insertedJobIds = matchesToSave
        .filter((_, index) => {
          // Only include jobs that were actually inserted (not skipped)
          return index < insertedCount;
        })
        .map(m => m.job_id);

      if (insertedJobIds.length > 0) {
        const { data: jobPlatforms } = await supabase
          .from('scraped_jobs')
          .select('id, primary_platform')
          .in('id', insertedJobIds);

        // Create platform map
        const jobPlatformMap = new Map<string, string | null>();
        (jobPlatforms || []).forEach((job: any) => {
          jobPlatformMap.set(job.id, job.primary_platform);
        });

        // Get candidate platform info
        const candidatePrimaryPlatform = profile.primary_platform;
        const candidateSecondaryPlatforms = profile.secondary_platforms || [];

        // Apply platform gating
        const insertedMatches = matchesToSave
          .slice(0, insertedCount)
          .map(m => ({ job_id: m.job_id }));

        const platformUpdates = applyPlatformGating(
          insertedMatches,
          candidatePrimaryPlatform,
          candidateSecondaryPlatforms,
          jobPlatformMap
        );

        // Update ai_visibility for platform mismatches (writable column for AI decisions)
        for (const update of platformUpdates) {
          if (update.ai_visibility === 'hidden_by_ai') {
            platformConflictsHidden++;
            
            await supabase
              .from('candidate_job_matches')
              .update({
                ai_visibility: 'hidden_by_ai',
                hidden_reason: update.hidden_reason,
                hidden_at: update.hidden_at,
              })
              .eq('candidate_id', profile.id)
              .eq('job_id', update.job_id);

            console.log(`[Match Jobs] Platform mismatch: Hidden job ${update.job_id.substring(0, 8)}... (${update.hidden_reason})`);
          } else {
            // Ensure visible jobs are marked as visible
            await supabase
              .from('candidate_job_matches')
              .update({
                ai_visibility: 'visible',
                hidden_reason: null,
                hidden_at: null,
              })
              .eq('candidate_id', profile.id)
              .eq('job_id', update.job_id);
          }
        }
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
      platform_conflicts_hidden: platformConflictsHidden,
      stats: matchingResult.stats,
      diagnostics, // Include diagnostic info
      ranking: {
        triggered: rankingTriggered,
        error: rankingError || undefined,
      },
      message: `Qualified ${insertedCount} new jobs (${explicitTargets} targeted, ${globalMatches} global). ${existingJobIds.size} already in ledger.${platformConflictsHidden > 0 ? ` ${platformConflictsHidden} hidden due to platform mismatch.` : ''}${rankingTriggered ? ' AI ranking triggered.' : ''}`,
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

    // ============================================
    // STEP 1: Fetch ledger rows ONLY (no nested joins)
    // ============================================
    const { matches, error: matchesError } = await fetchCandidateMatches(profile.id);

    if (matchesError) {
      console.error('[Active Feed] Ledger fetch failed:', matchesError);
      return NextResponse.json({ 
        jobs: [],
        diagnostics: {
          total_visible: 0,
          total_hidden_by_platform: 0,
          total_active_matches: 0,
        },
      });
    }

    if (!matches || matches.length === 0) {
      console.log('[Active Feed] No active visible jobs found for candidate');
      const diagnostics = await applyVisibilityRules(profile.id, []);
      return NextResponse.json({ 
        jobs: [],
        diagnostics,
      });
    }

    // ============================================
    // STEP 2: Apply visibility rules and get diagnostics
    // ============================================
    const diagnostics = await applyVisibilityRules(profile.id, matches);

    // ============================================
    // STEP 3: Fetch jobs explicitly (no nested joins)
    // ============================================
    const jobIds: string[] = matches.map((m) => m.job_id);
    const { jobs: jobsData, error: jobsError } = await fetchJobsByIds(jobIds);

    if (jobsError) {
      console.error('[Active Feed] Job fetch failed:', jobsError);
      return NextResponse.json({ 
        jobs: [],
        diagnostics,
      });
    }

    if (!jobsData) {
      return NextResponse.json({ 
        jobs: [],
        diagnostics,
      });
    }

    // ============================================
    // STEP 4: Merge matches with jobs and filter
    // ============================================
    const merged = mergeMatchesWithJobs(matches, jobsData, thirtyDaysAgo);

    // ============================================
    // STEP 5: Sort by priority
    // ============================================
    const sorted = sortJobsByPriority(merged);

    // ============================================
    // STEP 6: Log and update view tracking
    // ============================================
    logFeedFetch(profile.id, sorted.length, 'active');

    if (sorted.length > 0) {
      const returnedJobIds: string[] = sorted.map((j) => j.id);
      const now = new Date().toISOString();
      
      // Update last_seen_at for all jobs
      await supabase
        .from('candidate_job_matches')
        .update({ last_seen_at: now })
        .eq('candidate_id', profile.id)
        .in('job_id', returnedJobIds);
      
      // Set first_seen_at for jobs that haven't been seen before
      await supabase
        .from('candidate_job_matches')
        .update({ first_seen_at: now })
        .eq('candidate_id', profile.id)
        .in('job_id', returnedJobIds)
        .is('first_seen_at', null);
    }

    // ============================================
    // STEP 7: Build and return response
    // ============================================
    const response = buildDashboardResponse(sorted, diagnostics);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Active Feed] Error:', error);
    return NextResponse.json({ jobs: [] });
  }
}
