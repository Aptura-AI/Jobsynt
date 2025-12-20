/**
 * Dashboard Helper Functions
 * 
 * Pure functions for building candidate dashboard responses.
 * No side effects, no DB calls, strongly typed.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export type CandidateMatch = {
  job_id: string;
  match_score: number | null;
  match_source: string | null;
  ai_priority: string | null;
  qualified_at: string | null;
  reasons: string[] | null;
  visibility_status: string | null;
  ai_visibility: string | null;
};

export type ScrapedJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  job_type: string | null;
  location_type: string | null;
  is_remote: boolean | null;
  url: string | null;
  salary: string | null;
  pay_rate_min: number | null;
  pay_rate_max: number | null;
  description: string | null;
  posted_date: string | null;
};

export type DashboardJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  job_type: string | null;
  location_type: string | null;
  is_remote: boolean | null;
  url: string | null;
  salary: string | null;
  pay_rate_min: number | null;
  pay_rate_max: number | null;
  description: string | null;
  posted_date: string | null;
  fit_score: number | null;
  match_source: string | null;
  ai_priority: string | null;
  qualified_at: string | null;
  match_reasons: string[];
  is_recruiter_targeted: boolean;
};

export type VisibilityDiagnostics = {
  total_visible: number;
  total_hidden_by_platform: number;
  total_active_matches: number;
};

/**
 * Fetch candidate matches from ledger (no joins)
 */
export async function fetchCandidateMatches(
  candidateId: string
): Promise<{ matches: CandidateMatch[] | null; error: any }> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return { matches: null, error: new Error('Database not configured') };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: matches, error } = await supabase
    .from('candidate_job_matches')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('visibility_status', 'active')
    .or('ai_visibility.eq.visible,ai_visibility.is.null');

  return { matches, error };
}

/**
 * Apply visibility rules and count diagnostics
 */
export async function applyVisibilityRules(
  candidateId: string,
  visibleMatches: CandidateMatch[]
): Promise<VisibilityDiagnostics> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      total_visible: visibleMatches.length,
      total_hidden_by_platform: 0,
      total_active_matches: visibleMatches.length,
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Count hidden matches
  const { data: hiddenMatches } = await supabase
    .from('candidate_job_matches')
    .select('id')
    .eq('candidate_id', candidateId)
    .eq('visibility_status', 'active')
    .eq('ai_visibility', 'hidden_by_ai');

  const hiddenByPlatformCount: number = hiddenMatches?.length || 0;
  const visibleMatchCount: number = visibleMatches.length;

  return {
    total_visible: visibleMatchCount,
    total_hidden_by_platform: hiddenByPlatformCount,
    total_active_matches: visibleMatchCount + hiddenByPlatformCount,
  };
}

/**
 * Fetch jobs by IDs (no nested joins)
 */
export async function fetchJobsByIds(
  jobIds: string[]
): Promise<{ jobs: ScrapedJob[] | null; error: any }> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return { jobs: null, error: new Error('Database not configured') };
  }

  if (jobIds.length === 0) {
    return { jobs: [], error: null };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: jobs, error } = await supabase
    .from('scraped_jobs')
    .select('*')
    .in('id', jobIds);

  return { jobs, error };
}

/**
 * Merge matches with jobs and filter by date
 */
export function mergeMatchesWithJobs(
  matches: CandidateMatch[],
  jobs: ScrapedJob[],
  thirtyDaysAgoString: string
): DashboardJob[] {
  const jobMap = new Map<string, ScrapedJob>(jobs.map((j: ScrapedJob) => [j.id, j]));
  const thirtyDaysAgo = new Date(thirtyDaysAgoString);

  return matches
    .map((match: CandidateMatch) => {
      const job = jobMap.get(match.job_id);
      if (!job) {
        console.warn(`[Dashboard] Missing job for job_id: ${match.job_id}`);
        return null;
      }

      // Filter by date: NULL posted_date = treat as recent
      if (job.posted_date && new Date(job.posted_date) < thirtyDaysAgo) {
        return null;
      }

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
    })
    .filter((job): job is DashboardJob => job !== null);
}

/**
 * Sort jobs by priority
 */
export function sortJobsByPriority(jobs: DashboardJob[]): DashboardJob[] {
  const sorted = [...jobs];
  
  sorted.sort((a: DashboardJob, b: DashboardJob) => {
    // 1. Explicit targets first
    if (a.match_source === 'explicit_target' && b.match_source !== 'explicit_target') return -1;
    if (b.match_source === 'explicit_target' && a.match_source !== 'explicit_target') return 1;

    // 2. AI priority (High > Medium > Low > null)
    const priorityOrder: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
    const aPriority = priorityOrder[a.ai_priority || ''] || 0;
    const bPriority = priorityOrder[b.ai_priority || ''] || 0;
    if (aPriority !== bPriority) return bPriority - aPriority;

    // 3. Fit score
    const aScore = a.fit_score || 0;
    const bScore = b.fit_score || 0;
    if (bScore !== aScore) {
      return bScore - aScore;
    }

    // 4. Qualified at (newest first)
    const aTime = a.qualified_at ? new Date(a.qualified_at).getTime() : 0;
    const bTime = b.qualified_at ? new Date(b.qualified_at).getTime() : 0;
    return bTime - aTime;
  });

  return sorted;
}

/**
 * Build dashboard response
 */
export function buildDashboardResponse(
  jobs: DashboardJob[],
  diagnostics: VisibilityDiagnostics
): {
  jobs: DashboardJob[];
  total: number;
  message: string;
  diagnostics: VisibilityDiagnostics;
} {
  const returnedJobCount: number = jobs.length;

  return {
    jobs,
    total: returnedJobCount,
    message: returnedJobCount > 0
      ? `${returnedJobCount} qualified jobs in your feed`
      : 'No active jobs in feed. New matches will appear as they are qualified.',
    diagnostics,
  };
}

