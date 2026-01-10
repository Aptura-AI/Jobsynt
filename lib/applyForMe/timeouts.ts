/**
 * Intervention Timeout Management
 * 
 * Handles intervention timeouts, reminders, and hard stops.
 * 
 * Rules:
 * - Max intervention window: 10 minutes
 * - Reminder at 3 minutes
 * - Hard termination at 10 minutes
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const INTERVENTION_MAX_DURATION = 10 * 60 * 1000; // 10 minutes
export const INTERVENTION_REMINDER_INTERVAL = 3 * 60 * 1000; // 3 minutes

/**
 * Check if intervention has timed out
 */
export async function checkInterventionTimeout(applicationRunId: string): Promise<{
  timedOut: boolean;
  elapsed: number;
  needsReminder: boolean;
}> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return { timedOut: false, elapsed: 0, needsReminder: false };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: run, error } = await supabase
    .from('job_application_runs')
    .select('paused_at, intervention_reason')
    .eq('id', applicationRunId)
    .eq('status', 'WAITING_FOR_CANDIDATE')
    .maybeSingle();

  if (error || !run || !run.paused_at) {
    return { timedOut: false, elapsed: 0, needsReminder: false };
  }

  const pausedAt = new Date(run.paused_at);
  const now = new Date();
  const elapsed = now.getTime() - pausedAt.getTime();

  const timedOut = elapsed >= INTERVENTION_MAX_DURATION;
  const needsReminder = elapsed >= INTERVENTION_REMINDER_INTERVAL && elapsed < INTERVENTION_MAX_DURATION;

  return { timedOut, elapsed, needsReminder };
}

/**
 * Handle intervention timeout (hard stop)
 */
export async function handleInterventionTimeout(applicationRunId: string): Promise<void> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  await supabase
    .from('job_application_runs')
    .update({
      status: 'failed',
      error: 'INTERVENTION_TIMEOUT',
      intervention_reason: null,
      intervention_message: 'We paused this application because the step wasn\'t completed in time. You can retry this job later from your dashboard.',
      paused_at: null,
    })
    .eq('id', applicationRunId);

  console.log(`[Timeouts] Intervention timed out for application ${applicationRunId}`);
}

/**
 * Send reminder for intervention
 */
export async function sendInterventionReminder(applicationRunId: string): Promise<void> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Update intervention message with reminder
  const { data: run } = await supabase
    .from('job_application_runs')
    .select('intervention_reason, intervention_message')
    .eq('id', applicationRunId)
    .maybeSingle();

  if (!run) {
    return;
  }

  const reminderMessage = run.intervention_message 
    ? `${run.intervention_message}\n\nJust a reminder — we're waiting for this step to be completed so we can continue.`
    : 'Just a reminder — we\'re waiting for this step to be completed so we can continue.';

  await supabase
    .from('job_application_runs')
    .update({
      intervention_message: reminderMessage,
    })
    .eq('id', applicationRunId);

  console.log(`[Timeouts] Sent reminder for application ${applicationRunId}`);
}

/**
 * Monitor and handle timeouts for all active interventions
 */
export async function monitorInterventionTimeouts(): Promise<void> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Find all waiting interventions
  const { data: waitingRuns, error } = await supabase
    .from('job_application_runs')
    .select('id, paused_at')
    .eq('status', 'WAITING_FOR_CANDIDATE')
    .not('paused_at', 'is', null);

  if (error || !waitingRuns) {
    return;
  }

  for (const run of waitingRuns) {
    const timeoutCheck = await checkInterventionTimeout(run.id);

    if (timeoutCheck.timedOut) {
      await handleInterventionTimeout(run.id);
    } else if (timeoutCheck.needsReminder) {
      // Check if we've already sent a reminder (avoid spam)
      const { data: currentRun } = await supabase
        .from('job_application_runs')
        .select('intervention_message')
        .eq('id', run.id)
        .maybeSingle();

      if (currentRun && !currentRun.intervention_message?.includes('Just a reminder')) {
        await sendInterventionReminder(run.id);
      }
    }
  }
}

