/**
 * Learning Signals Logging
 * 
 * Collects learning data from candidate actions without affecting behavior.
 * This is for future ML improvements - no scoring changes yet.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type LearningAction = 'apply' | 'dismiss' | 'save';

export interface LearningSignalData {
  match_score?: number;
  ai_priority?: string;
  match_source?: 'explicit_target' | 'global_match';
  job_source?: 'recruiter' | 'scraper';
  manually_curated?: boolean;
  fallback_primary_platform_used?: boolean;
  [key: string]: any; // Allow additional context
}

/**
 * Log a learning signal when candidate action occurs
 * This is metadata collection only - no behavior changes
 */
export async function logLearningSignal(
  candidateId: string,
  jobId: string,
  action: LearningAction,
  signalData: LearningSignalData = {}
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error } = await supabase
      .from('learning_signals')
      .insert({
        candidate_id: candidateId,
        job_id: jobId,
        action,
        signal_data: signalData,
      });
    
    if (error) {
      console.error('[Learning Signal] Error:', error);
    } else {
      console.log(`[Learning Signal] ${action.toUpperCase()}: candidate=${candidateId.substring(0, 8)}... job=${jobId.substring(0, 8)}...`);
    }
  } catch (err) {
    console.error('[Learning Signal] Exception:', err);
    // Fail silently - learning signals should never break the flow
  }
}

