/**
 * Get Eligible Jobs
 * 
 * Main entry point for job matching.
 * Applies hard filters, scores jobs, and returns only high-quality matches (≥70%).
 * 
 * This is the gatekeeper that ensures AI only sees pre-filtered, high-scoring jobs.
 */

import { hardFilterJobs, type Job, type CandidateProfile } from './hardFilterJobs';
import { calculateMatchScore, type ScoreBreakdown } from './calculateMatchScore';
import { get30DaysAgoDate } from '@/lib/job-filters';

export type EligibleJob = Job & {
  match_score: number;
  score_breakdown: ScoreBreakdown;
};

export type MatchingResult = {
  eligible: EligibleJob[];
  filtered: Array<{ job: Job; reason: string }>;
  lowScore: Array<{ job: Job; score: number; breakdown: ScoreBreakdown; reason: string }>;
  stats: {
    total: number;
    passedHardFilters: number;
    passedScoring: number;
    filteredOut: number;
    lowScoreRejected: number;
  };
};

/**
 * Get eligible jobs for a candidate
 * 
 * Flow:
 * 1. Fetch jobs from scraped_jobs (with 30-day filter)
 * 2. Apply hard filters (location, job type)
 * 3. Score each job
 * 4. Return only jobs with score ≥70
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
    passedHardFilters: 0,
    passedScoring: 0,
    filteredOut: 0,
    lowScoreRejected: 0,
  };

  // Step 1: Apply hard filters
  const { passed: hardFilteredJobs, filtered: hardFiltered } = hardFilterJobs(jobs, candidate);
  stats.passedHardFilters = hardFilteredJobs.length;
  stats.filteredOut = hardFiltered.length;

  if (logFiltering && hardFiltered.length > 0) {
    console.log(`[Job Matching] Hard filtered ${hardFiltered.length} jobs:`);
    hardFiltered.forEach(({ job, reason }) => {
      console.log(`  - ${job.title} at ${job.company}: ${reason}`);
    });
  }

  // Step 2: Score each job
  const eligible: EligibleJob[] = [];
  const lowScore: Array<{ job: Job; score: number; breakdown: ScoreBreakdown; reason: string }> = [];

  for (const job of hardFilteredJobs) {
    const { score, breakdown } = calculateMatchScore(job, candidate);

    if (score >= minScore) {
      eligible.push({
        ...job,
        match_score: score,
        score_breakdown: breakdown,
      });
      stats.passedScoring++;
    } else {
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
    console.log(`[Job Matching] Rejected ${lowScore.length} jobs due to low scores:`);
    lowScore.slice(0, 10).forEach(({ job, score, breakdown }) => {
      console.log(`  - ${job.title} at ${job.company}: Score ${score} (skills: ${breakdown.skills}, exp: ${breakdown.experience}, pay: ${breakdown.pay})`);
    });
  }

  if (logFiltering) {
    console.log(`[Job Matching] Final stats:`, stats);
    console.log(`[Job Matching] Passing ${eligible.length} jobs to AI (score ≥${minScore})`);
  }

  return {
    eligible,
    filtered: hardFiltered,
    lowScore,
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
  const limit = options.limit ?? 100;
  const thirtyDaysAgo = get30DaysAgoDate();

  // Fetch jobs from last 30 days
  let query = supabase
    .from('scraped_jobs')
    .select('*')
    .eq('is_active', true)
    .gte('posted_date', thirtyDaysAgo)
    .limit(limit);

  const { data: jobs, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch jobs: ${error.message}`);
  }

  if (!jobs || jobs.length === 0) {
    return {
      eligible: [],
      filtered: [],
      lowScore: [],
      stats: {
        total: 0,
        passedHardFilters: 0,
        passedScoring: 0,
        filteredOut: 0,
        lowScoreRejected: 0,
      },
    };
  }

  return getEligibleJobs(jobs, candidate, options);
}

