/**
 * Get Eligible Jobs
 * 
 * Main entry point for job matching.
 * Uses LENIENT pre-filter to let jobs through, then AI does the ranking.
 * 
 * Two-Phase Matching:
 * - Phase 1: Lenient deterministic pre-filter (this file)
 * - Phase 2: AI ranking and scoring (handled separately)
 */

import { lenientPreFilter, type Job, type CandidateProfile, type RejectionLog, type MatchSource, type PassedJob } from './lenientPreFilter';
import { calculateMatchScore, type ScoreBreakdown } from './calculateMatchScore';
import { get30DaysAgoDate } from '@/lib/job-filters';

export type EligibleJob = Job & {
  match_score: number;
  score_breakdown: ScoreBreakdown;
  match_source: MatchSource;
};

export type MatchingResult = {
  eligible: EligibleJob[];
  filtered: Array<{ job: Job; reason: string }>;
  lowScore: Array<{ job: Job; score: number; breakdown: ScoreBreakdown; reason: string }>;
  rejectionLogs: RejectionLog[];
  stats: {
    total: number;
    passedPreFilter: number;
    passedScoring: number;
    filteredOut: number;
    lowScoreRejected: number;
    passRate: number;
    explicitTargetCount: number;
    globalMatchCount: number;
  };
};

/**
 * Get eligible jobs for a candidate
 * 
 * Flow:
 * 1. Fetch jobs from scraped_jobs (with 30-day filter)
 * 2. Apply LENIENT pre-filter (location, job type, visa, experience, skills)
 * 3. Score each job
 * 4. Return jobs with score ≥70% for AI ranking
 * 
 * Note: The pre-filter is intentionally lenient to let more jobs through.
 * AI will handle the final ranking and prioritization.
 */
export async function getEligibleJobs(
  jobs: Job[],
  candidate: CandidateProfile,
  options: {
    minScore?: number;
    logFiltering?: boolean;
  } = {}
): Promise<MatchingResult> {
  const minScore = options.minScore ?? 70;
  const logFiltering = options.logFiltering ?? false;

  const stats = {
    total: jobs.length,
    passedPreFilter: 0,
    passedScoring: 0,
    filteredOut: 0,
    lowScoreRejected: 0,
    passRate: 0,
    explicitTargetCount: 0,
    globalMatchCount: 0,
  };

  // Handle empty jobs array
  if (jobs.length === 0) {
    return {
      eligible: [],
      filtered: [],
      lowScore: [],
      rejectionLogs: [],
      stats: { ...stats, passRate: 0 },
    };
  }

  // Step 1: Apply LENIENT pre-filter (includes explicit targeting)
  const { 
    passed: preFilteredJobs, 
    filtered: preFiltered, 
    rejectionLogs,
    explicitTargetCount,
    globalMatchCount,
  } = lenientPreFilter(jobs, candidate);
  
  stats.explicitTargetCount = explicitTargetCount;
  stats.globalMatchCount = globalMatchCount;
  stats.passedPreFilter = preFilteredJobs.length;
  stats.filteredOut = preFiltered.length;
  stats.passRate = Math.round((preFilteredJobs.length / jobs.length) * 100);

  if (logFiltering && preFiltered.length > 0) {
    console.log(`[Job Matching] Pre-filtered ${preFiltered.length} jobs:`);
    preFiltered.slice(0, 10).forEach(({ job, reason }) => {
      console.log(`  - ${job.title} at ${job.company}: ${reason}`);
    });
    if (preFiltered.length > 10) {
      console.log(`  ... and ${preFiltered.length - 10} more`);
    }
  }

  // Log warning if pass rate is too low
  if (stats.passRate < 10 && jobs.length > 5) {
    console.warn(`[Job Matching] WARNING: Only ${stats.passRate}% pass rate. Check filter logic.`);
    console.log('[Job Matching] Rejection breakdown by reason:');
    const reasonCounts: Record<string, number> = {};
    for (const log of rejectionLogs) {
      reasonCounts[log.reason] = (reasonCounts[log.reason] || 0) + 1;
    }
    Object.entries(reasonCounts).forEach(([reason, count]) => {
      console.log(`  - ${reason}: ${count} jobs`);
    });
  }

  // Step 2: Score each job that passed pre-filter
  const eligible: EligibleJob[] = [];
  const lowScore: Array<{ job: Job; score: number; breakdown: ScoreBreakdown; reason: string }> = [];

  for (const job of preFilteredJobs) {
    const { score, breakdown } = calculateMatchScore(job, candidate);

    // EXPLICIT TARGETS: Always include regardless of score (recruiter intent)
    if (job.match_source === 'explicit_target') {
      eligible.push({
        ...job,
        match_score: Math.max(score, 70), // Ensure minimum score of 70 for explicit targets
        score_breakdown: breakdown,
        match_source: 'explicit_target',
      });
      stats.passedScoring++;
      continue;
    }

    // GLOBAL MATCHES: Apply score threshold (70% default)
    if (score >= minScore) {
      eligible.push({
        ...job,
        match_score: score,
        score_breakdown: breakdown,
        match_source: job.match_source || 'global_match',
      });
      stats.passedScoring++;
    } else {
      // Jobs below threshold are rejected
      lowScore.push({
        job,
        score,
        breakdown,
        reason: `Score ${score} below threshold ${minScore}`,
      });
      stats.lowScoreRejected++;
    }
  }

  if (logFiltering && lowScore.length > 0) {
    console.log(`[Job Matching] ${lowScore.length} jobs below score threshold:`);
    lowScore.slice(0, 5).forEach(({ job, score, breakdown }) => {
      console.log(`  - ${job.title} at ${job.company}: Score ${score} (skills: ${breakdown.skills}, exp: ${breakdown.experience}, pay: ${breakdown.pay})`);
    });
  }

  if (logFiltering) {
    console.log(`[Job Matching] Final stats:`, stats);
    console.log(`[Job Matching] Passing ${eligible.length} jobs to AI`);
  }

  return {
    eligible,
    filtered: preFiltered,
    lowScore,
    rejectionLogs,
    stats,
  };
}

/**
 * Helper: Fetch jobs from database and apply matching
 */
export async function fetchAndMatchJobs(
  supabase: any,
  candidate: CandidateProfile,
  options: {
    minScore?: number;
    limit?: number;
    logFiltering?: boolean;
  } = {}
): Promise<MatchingResult> {
  const limit = options.limit ?? 200; // Increased limit for more matches
  const thirtyDaysAgo = get30DaysAgoDate();

  // Fetch jobs from last 30 days
  // Note: is_active can be NULL (not yet set) or true
  // Note: posted_date can be NULL (use created_at as fallback)
  
  // First, try with posted_date filter
  let { data: jobs, error } = await supabase
    .from('scraped_jobs')
    .select('*')
    .or('is_active.is.null,is_active.eq.true') // Allow NULL or true
    .or(`posted_date.gte.${thirtyDaysAgo},posted_date.is.null`) // Allow NULL posted_date
    .order('created_at', { ascending: false })
    .limit(limit);

  console.log(`[Job Matching] Query returned ${jobs?.length || 0} jobs from scraped_jobs`);
  
  // If no jobs found, try without date filter as fallback
  if ((!jobs || jobs.length === 0) && !error) {
    console.log(`[Job Matching] No jobs found with date filter, trying without...`);
    const fallback = await supabase
      .from('scraped_jobs')
      .select('*')
      .or('is_active.is.null,is_active.eq.true')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (fallback.data && fallback.data.length > 0) {
      jobs = fallback.data;
      console.log(`[Job Matching] Fallback found ${jobs.length} jobs without date filter`);
    }
  }
  
  if (jobs && jobs.length > 0) {
    // Log first job for debugging
    console.log(`[Job Matching] Sample job: ${jobs[0].title} at ${jobs[0].company}, is_active=${jobs[0].is_active}, posted=${jobs[0].posted_date}, created=${jobs[0].created_at}`);
  }

  if (error) {
    console.error('Failed to fetch jobs:', error);
    throw new Error(`Failed to fetch jobs: ${error.message}`);
  }

  if (!jobs || jobs.length === 0) {
    console.log('[Job Matching] No jobs found in database (last 30 days)');
    return {
      eligible: [],
      filtered: [],
      lowScore: [],
      rejectionLogs: [],
      stats: {
        total: 0,
        passedPreFilter: 0,
        passedScoring: 0,
        filteredOut: 0,
        lowScoreRejected: 0,
        passRate: 0,
        explicitTargetCount: 0,
        globalMatchCount: 0,
      },
    };
  }

  console.log(`[Job Matching] Found ${jobs.length} jobs in database`);
  return getEligibleJobs(jobs, candidate, options);
}
