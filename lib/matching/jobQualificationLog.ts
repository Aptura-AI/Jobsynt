/**
 * Job Qualification Logging
 * 
 * Provides audit trail for all job qualification events.
 * This is REQUIRED for the ledger-based system.
 * 
 * Log entries:
 * - qualified: Job was inserted into candidate_job_matches
 * - applied: Candidate applied to the job
 * - dismissed: Candidate dismissed the job
 * - expired: Job exceeded 30-day window
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type QualificationAction = 'qualified' | 'applied' | 'dismissed' | 'expired';

export interface LogEntry {
  candidate_id: string;
  job_id: string;
  action: QualificationAction;
  reason?: string;
  match_source?: 'explicit_target' | 'global_match';
  fit_score?: number;
}

/**
 * Log a job qualification event
 */
export async function logJobQualification(entry: LogEntry): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error } = await supabase
      .from('job_qualification_log')
      .insert({
        candidate_id: entry.candidate_id,
        job_id: entry.job_id,
        action: entry.action,
        reason: entry.reason,
        match_source: entry.match_source,
        fit_score: entry.fit_score,
      });
    
    if (error) {
      console.error('[Job Qualification Log] Error:', error);
    } else {
      console.log(`[Job Qualification Log] ${entry.action.toUpperCase()}: candidate=${entry.candidate_id.substring(0, 8)}... job=${entry.job_id.substring(0, 8)}... reason=${entry.reason || 'N/A'}`);
    }
  } catch (err) {
    console.error('[Job Qualification Log] Exception:', err);
  }
}

/**
 * Log when a job is first qualified for a candidate
 */
export async function logJobQualified(
  candidateId: string,
  jobId: string,
  matchSource: 'explicit_target' | 'global_match',
  fitScore: number,
  reason: string
): Promise<void> {
  await logJobQualification({
    candidate_id: candidateId,
    job_id: jobId,
    action: 'qualified',
    match_source: matchSource,
    fit_score: fitScore,
    reason,
  });
}

/**
 * Log when a candidate applies to a job
 */
export async function logJobApplied(
  candidateId: string,
  jobId: string,
  reason?: string
): Promise<void> {
  await logJobQualification({
    candidate_id: candidateId,
    job_id: jobId,
    action: 'applied',
    reason: reason || 'Candidate applied via dashboard',
  });
}

/**
 * Log when a candidate dismisses a job
 */
export async function logJobDismissed(
  candidateId: string,
  jobId: string,
  reason?: string
): Promise<void> {
  await logJobQualification({
    candidate_id: candidateId,
    job_id: jobId,
    action: 'dismissed',
    reason: reason || 'Candidate dismissed job',
  });
}

/**
 * Log when a job expires (>30 days old)
 */
export async function logJobExpired(
  candidateId: string,
  jobId: string
): Promise<void> {
  await logJobQualification({
    candidate_id: candidateId,
    job_id: jobId,
    action: 'expired',
    reason: 'Job exceeded 30-day window',
  });
}

/**
 * Log feed fetch (for debugging/analytics)
 */
export function logFeedFetch(
  candidateId: string,
  jobCount: number,
  feedType: 'active' | 'past'
): void {
  console.log(`[Feed Fetch] ${feedType.toUpperCase()}: candidate=${candidateId.substring(0, 8)}... jobs=${jobCount}`);
}

