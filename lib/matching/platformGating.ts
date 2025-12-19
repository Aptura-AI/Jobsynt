/**
 * Platform Gating Logic
 * 
 * Deterministic platform matching to prevent cross-platform job recommendations.
 * This runs BEFORE AI ranking and ensures only compatible platforms are shown.
 * 
 * Rules:
 * - job.primary_platform === candidate.primary_platform OR
 * - job.primary_platform IN candidate.secondary_platforms
 * 
 * If mismatch: Set ai_visibility = 'hidden_by_ai', hidden_reason = 'platform_mismatch'
 * DO NOT delete ledger rows - preserve for auditability
 */

export type PlatformGatingResult = {
  isVisible: boolean;
  reason?: string;
};

/**
 * Check if a job's platform matches the candidate's platform
 * 
 * @param candidatePrimaryPlatform - Candidate's primary platform
 * @param candidateSecondaryPlatforms - Candidate's secondary platforms (array)
 * @param jobPrimaryPlatform - Job's primary platform
 * @returns PlatformGatingResult indicating if job should be visible
 */
export function checkPlatformMatch(
  candidatePrimaryPlatform: string | null | undefined,
  candidateSecondaryPlatforms: string[] | null | undefined,
  jobPrimaryPlatform: string | null | undefined
): PlatformGatingResult {
  // If candidate has no primary platform set, allow all jobs (backward compatibility)
  if (!candidatePrimaryPlatform) {
    return { isVisible: true, reason: 'candidate_platform_not_set' };
  }

  // If job has no platform set, allow it (backward compatibility)
  if (!jobPrimaryPlatform) {
    return { isVisible: true, reason: 'job_platform_not_set' };
  }

  // Normalize platforms (case-insensitive, trim whitespace)
  const candidatePlatform = candidatePrimaryPlatform.trim().toLowerCase();
  const jobPlatform = jobPrimaryPlatform.trim().toLowerCase();

  // Check primary platform match
  if (candidatePlatform === jobPlatform) {
    return { isVisible: true, reason: 'primary_platform_match' };
  }

  // Check secondary platforms match
  const secondaryPlatforms = (candidateSecondaryPlatforms || []).map(p => p.trim().toLowerCase());
  if (secondaryPlatforms.includes(jobPlatform)) {
    return { isVisible: true, reason: 'secondary_platform_match' };
  }

  // Platform mismatch - hide job
  return {
    isVisible: false,
    reason: `platform_mismatch: candidate=${candidatePlatform}, job=${jobPlatform}`,
  };
}

/**
 * Apply platform gating to a batch of job matches
 * 
 * @param matches - Array of matches to check
 * @param candidatePrimaryPlatform - Candidate's primary platform
 * @param candidateSecondaryPlatforms - Candidate's secondary platforms
 * @param jobPlatformMap - Map of job_id -> primary_platform
 * @returns Array of updates to apply (ai_visibility, hidden_reason, hidden_at)
 * 
 * NOTE: Uses ai_visibility (writable) NOT visibility_status (generated/read-only)
 */
export function applyPlatformGating(
  matches: Array<{ job_id: string }>,
  candidatePrimaryPlatform: string | null | undefined,
  candidateSecondaryPlatforms: string[] | null | undefined,
  jobPlatformMap: Map<string, string | null>
): Array<{
  job_id: string;
  ai_visibility: 'visible' | 'hidden_by_ai';
  hidden_reason: string | null;
  hidden_at: string | null;
}> {
  const updates: Array<{
    job_id: string;
    ai_visibility: 'visible' | 'hidden_by_ai';
    hidden_reason: string | null;
    hidden_at: string | null;
  }> = [];

  for (const match of matches) {
    const jobPlatform = jobPlatformMap.get(match.job_id) || null;
    const result = checkPlatformMatch(
      candidatePrimaryPlatform,
      candidateSecondaryPlatforms,
      jobPlatform
    );

    if (result.isVisible) {
      updates.push({
        job_id: match.job_id,
        ai_visibility: 'visible',
        hidden_reason: null,
        hidden_at: null,
      });
    } else {
      updates.push({
        job_id: match.job_id,
        ai_visibility: 'hidden_by_ai',
        hidden_reason: result.reason || 'platform_mismatch',
        hidden_at: new Date().toISOString(),
      });
    }
  }

  return updates;
}

