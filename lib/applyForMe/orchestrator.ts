/**
 * Apply for Me Orchestrator
 * 
 * Coordinates sequential job application processing using Playwright.
 * 
 * Responsibilities:
 * - Iterate jobs sequentially
 * - Maintain per-job state
 * - Never crash entire batch
 * - Always close browser tabs
 * - Update job_application_runs status
 */

import { createClient } from '@supabase/supabase-js';
import { applyToJob } from './playwrightAutomation';
import { SupportedApplySite } from './types';
import type { ApplicationRun } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Detect site from job URL
 */
function detectSiteFromUrl(url: string): SupportedApplySite {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('dice.com')) return 'DICE';
  if (urlLower.includes('greenhouse.io') || urlLower.includes('boards.greenhouse.io')) return 'GREENHOUSE';
  if (urlLower.includes('techfetch.com')) return 'TECHFETCH';
  if (urlLower.includes('ziprecruiter.com')) return 'ZIPRECRUITER';
  return 'DICE'; // Default fallback
}

export interface JobDetails {
  id: string;
  title: string;
  company: string;
  url: string;
  description?: string;
}

export interface CandidateProfile {
  id: string;
  resume_json: any;
  name?: string;
  email?: string;
}

/**
 * Process a single application run
 */
async function processApplicationRun(
  run: ApplicationRun,
  job: JobDetails,
  candidate: CandidateProfile,
  isResuming: boolean = false
): Promise<{ success: boolean; error?: string; paused?: boolean; interventionReason?: string }> {
  // If resuming, check if intervention is resolved first
  if (isResuming && run.intervention_reason) {
    // TODO: Re-check intervention status before resuming
    // For now, proceed with application
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Mark as running
    await supabase
      .from('job_application_runs')
      .update({ status: 'running' })
      .eq('id', run.id);

    // Detect site from URL
    const site = detectSiteFromUrl(run.job_url);

    // Apply to job using Playwright
    const result = await applyToJob({
      jobUrl: run.job_url,
      jobTitle: job.title,
      jobCompany: job.company,
      jobDescription: job.description || '',
      candidateProfile: candidate.resume_json,
      candidateName: candidate.name || '',
      candidateEmail: candidate.email || '',
      applicationRunId: run.id,
      site,
      isResuming,
    });

    if (result.success) {
      // Mark as submitted
      await supabase
        .from('job_application_runs')
        .update({
          status: 'submitted',
          applied_at: new Date().toISOString(),
          error: null,
        })
        .eq('id', run.id);

      return { success: true };
    } else {
      // Mark as failed
      await supabase
        .from('job_application_runs')
        .update({
          status: 'failed',
          error: result.error || 'Application failed',
        })
        .eq('id', run.id);

      return { success: false, error: result.error };
    }
  } catch (error: any) {
    // Mark as failed on exception
    await supabase
      .from('job_application_runs')
      .update({
        status: 'failed',
        error: error.message || 'Unexpected error during application',
      })
      .eq('id', run.id);

    return { success: false, error: error.message };
  }
}

/**
 * Process all pending application runs for a candidate
 * 
 * Processes jobs sequentially, one at a time.
 * One job failure does not stop the batch.
 */
export async function processPendingApplications(candidateId: string): Promise<{
  processed: number;
  submitted: number;
  failed: number;
}> {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Database not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch pending or waiting runs (resume paused applications)
  const { data: runs, error: runsError } = await supabase
    .from('job_application_runs')
    .select('id, candidate_id, job_id, job_url, status, intervention_reason')
    .eq('candidate_id', candidateId)
    .in('status', ['pending', 'WAITING_FOR_CANDIDATE'])
    .order('created_at', { ascending: true });

  if (runsError || !runs || runs.length === 0) {
    return { processed: 0, submitted: 0, failed: 0 };
  }

  // Get candidate profile
  const { data: candidate, error: candidateError } = await supabase
    .from('profiles')
    .select('id, resume_json, name, email')
    .eq('id', candidateId)
    .maybeSingle();

  if (candidateError || !candidate || !candidate.resume_json) {
    throw new Error('Candidate profile or resume not found');
  }

  let submitted = 0;
  let failed = 0;

  // Process each job sequentially
  for (const run of runs) {
    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('scraped_jobs')
      .select('id, title, company, url, description')
      .eq('id', run.job_id)
      .maybeSingle();

    if (jobError || !job) {
      // Mark run as failed if job not found
      await supabase
        .from('job_application_runs')
        .update({
          status: 'failed',
          error: 'Job not found',
        })
        .eq('id', run.id);
      failed++;
      continue;
    }

    // Check if this run was paused (WAITING_FOR_CANDIDATE)
    // If paused, we need to resume from where it left off
    const isResuming = run.status === 'WAITING_FOR_CANDIDATE';

    // Process application
    const result = await processApplicationRun(
      run,
      {
        id: job.id,
        title: job.title,
        company: job.company,
        url: job.url || '',
        description: job.description || undefined,
      },
      {
        id: candidate.id,
        resume_json: candidate.resume_json,
        name: candidate.name || undefined,
        email: candidate.email || undefined,
      },
      isResuming
    );

    if (result.success) {
      submitted++;
    } else if (result.paused) {
      // Application was paused for human intervention - this is not a failure
      // Don't increment failed count, just continue to next job
      console.log(`[Orchestrator] Application ${run.id} paused for intervention: ${result.interventionReason}`);
      // Don't break - continue with other jobs
    } else {
      failed++;
      
      // With collaborative flow, CAPTCHA should pause, not fail
      // Only fail on actual errors
      console.error(`[Orchestrator] Application ${run.id} failed: ${result.error}`);
    }

    // Small delay between jobs to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return {
    processed: runs.length,
    submitted,
    failed,
  };
}

