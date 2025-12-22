/**
 * Centralized access check utilities
 * 
 * SINGLE SOURCE OF TRUTH for all access decisions
 * All access checks MUST use this function - no duplicated logic allowed
 */

export type ProfileData = {
  is_paid?: boolean | null;
  trial_ends_at?: string | null;
};

/**
 * Check if candidate has access (active trial or paid)
 * 
 * CLIENT-SIDE: Use with profile object (synchronous)
 * @param profile - Profile object with is_paid and trial_ends_at
 * @returns true if candidate has access (paid or active trial)
 */
export function hasCandidateAccess(profile: ProfileData): boolean {
  // Check if paid
  if (profile.is_paid === true) {
    return true;
  }

  // Check if trial is active
  if (profile.trial_ends_at) {
    const trialEndsAt = new Date(profile.trial_ends_at);
    const now = new Date();
    if (trialEndsAt > now) {
      return true;
    }
  }

  return false;
}

/**
 * Server-side access check (async, includes payment_events check)
 * 
 * SERVER-SIDE: Use with profileId and supabase client
 * @param profileId - Candidate profile ID
 * @param supabase - Supabase client instance
 * @returns true if candidate has access (paid or active trial)
 */
export async function hasCandidateAccessServer(
  profileId: string,
  supabase: any
): Promise<boolean> {
  // Check profile for payment status
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_paid, trial_ends_at')
    .eq('id', profileId)
    .maybeSingle();

  // Check if paid
  if (profile?.is_paid === true) {
    return true;
  }

  // Check if trial is active
  if (profile?.trial_ends_at) {
    const trialEndsAt = new Date(profile.trial_ends_at);
    const now = new Date();
    if (trialEndsAt > now) {
      return true;
    }
  }

  // Check for completed payment in payment_events
  const { data: payments } = await supabase
    .from('payment_events')
    .select('id, status')
    .eq('candidate_id', profileId)
    .eq('status', 'completed')
    .limit(1);

  return (payments?.length ?? 0) > 0;
}

/**
 * Get pricing URL with job source tracking
 */
export function getPricingUrl(jobId?: string): string {
  if (jobId) {
    return `/pricing?source=job_click&job_id=${jobId}`;
  }
  return '/pricing';
}

