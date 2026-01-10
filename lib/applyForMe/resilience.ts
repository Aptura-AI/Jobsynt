/**
 * Resilience Module
 * 
 * Handles browser crash recovery, resume from failures, and state persistence.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Recover from browser crash
 * Marks running applications as failed if they've been running too long
 */
export async function recoverFromBrowserCrash(): Promise<void> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Find runs that have been "running" for more than 10 minutes (likely crashed)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: staleRuns, error } = await supabase
    .from('job_application_runs')
    .select('id, updated_at')
    .eq('status', 'running')
    .lt('updated_at', tenMinutesAgo);

  if (error || !staleRuns || staleRuns.length === 0) {
    return;
  }

  // Mark stale runs as failed (browser likely crashed)
  for (const run of staleRuns) {
    await supabase
      .from('job_application_runs')
      .update({
        status: 'failed',
        error: 'Browser session timeout - application may have crashed. Please try again.',
      })
      .eq('id', run.id);
  }

  console.log(`[Resilience] Recovered ${staleRuns.length} stale application runs`);
}

/**
 * Check for abandoned paused applications
 * If paused for more than 24 hours, mark as failed
 */
export async function cleanupAbandonedPauses(): Promise<void> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Find runs paused for more than 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: abandonedRuns, error } = await supabase
    .from('job_application_runs')
    .select('id, paused_at')
    .eq('status', 'WAITING_FOR_CANDIDATE')
    .lt('paused_at', twentyFourHoursAgo);

  if (error || !abandonedRuns || abandonedRuns.length === 0) {
    return;
  }

  // Mark abandoned runs as failed
  for (const run of abandonedRuns) {
    await supabase
      .from('job_application_runs')
      .update({
        status: 'failed',
        error: 'Application abandoned - paused for more than 24 hours. Please start a new application.',
        intervention_reason: null,
        intervention_message: null,
      })
      .eq('id', run.id);
  }

  console.log(`[Resilience] Cleaned up ${abandonedRuns.length} abandoned paused applications`);
}

/**
 * Initialize resilience checks (call on server startup)
 */
export async function initializeResilience(): Promise<void> {
  // Run recovery checks
  await recoverFromBrowserCrash();
  await cleanupAbandonedPauses();
  
  // Import and run timeout monitoring
  const { monitorInterventionTimeouts } = await import('./timeouts');
  await monitorInterventionTimeouts();

  // Schedule periodic checks (every 5 minutes)
  setInterval(async () => {
    await recoverFromBrowserCrash();
    await cleanupAbandonedPauses();
    await monitorInterventionTimeouts();
  }, 5 * 60 * 1000);
}

