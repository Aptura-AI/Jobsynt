/**
 * Target Candidate IDs Utility
 * 
 * Handles normalization and validation of recruiter-targeted job assignments.
 * Recruiters can paste comma-separated UUIDs to explicitly target jobs to candidates.
 * 
 * KEY RULES:
 * - NULL/empty → ["GLOBAL"] (all candidates see the job)
 * - With UUIDs → ["GLOBAL", "uuid1", "uuid2", ...] (GLOBAL always included)
 * - Explicit targets override pre-filters (recruiter intent is honored)
 */

/**
 * Normalize target candidate IDs from raw string input
 * 
 * @param raw - Raw comma-separated UUID string from admin upload
 * @returns Array of normalized target IDs, always includes "GLOBAL"
 * 
 * @example
 * normalizeTargetCandidateIds(null) // ["GLOBAL"]
 * normalizeTargetCandidateIds("") // ["GLOBAL"]
 * normalizeTargetCandidateIds("uuid1") // ["GLOBAL", "uuid1"]
 * normalizeTargetCandidateIds("uuid1, uuid2") // ["GLOBAL", "uuid1", "uuid2"]
 */
export function normalizeTargetCandidateIds(raw: string | null | undefined): string[] {
  // If null, empty, or whitespace → return ["GLOBAL"]
  if (!raw || raw.trim() === '') {
    return ['GLOBAL'];
  }

  // Split by comma, trim each value, remove empty entries
  const ids = raw
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

  // If no valid IDs after processing, return ["GLOBAL"]
  if (ids.length === 0) {
    return ['GLOBAL'];
  }

  // ALWAYS prepend "GLOBAL" and deduplicate
  const result = ['GLOBAL', ...ids];
  return Array.from(new Set(result));
}

/**
 * Check if a job explicitly targets a specific candidate
 * 
 * @param targetIds - Normalized target IDs array
 * @param candidateId - Candidate UUID to check
 * @returns true if candidate is explicitly targeted
 */
export function isExplicitlyTargeted(targetIds: string[], candidateId: string): boolean {
  if (!candidateId) return false;
  return targetIds.includes(candidateId);
}

/**
 * Check if a job is globally available (not restricted to specific candidates)
 * 
 * @param targetIds - Normalized target IDs array
 * @returns true if job is available to all candidates via GLOBAL
 */
export function isGlobalJob(targetIds: string[]): boolean {
  return targetIds.includes('GLOBAL');
}

/**
 * Determine match source for a job-candidate pair
 * 
 * @param targetIds - Normalized target IDs array
 * @param candidateId - Candidate UUID
 * @returns "explicit_target" if explicitly targeted, "global_match" otherwise
 */
export function getMatchSource(
  targetIds: string[], 
  candidateId: string
): 'explicit_target' | 'global_match' {
  if (isExplicitlyTargeted(targetIds, candidateId)) {
    return 'explicit_target';
  }
  return 'global_match';
}

/**
 * Parse raw target_candidate_ids from database job record
 * Returns normalized array for matching logic
 */
export function parseJobTargets(job: { target_candidate_ids?: string | null }): string[] {
  return normalizeTargetCandidateIds(job.target_candidate_ids);
}

/**
 * Check if candidate should see this job
 * Returns true if:
 * - Candidate is explicitly targeted, OR
 * - Job is GLOBAL (available to all)
 */
export function shouldCandidateSeeJob(
  job: { target_candidate_ids?: string | null },
  candidateId: string
): { shouldSee: boolean; matchSource: 'explicit_target' | 'global_match'; bypassFilters: boolean } {
  const targets = parseJobTargets(job);
  
  // Check explicit targeting first
  if (isExplicitlyTargeted(targets, candidateId)) {
    return {
      shouldSee: true,
      matchSource: 'explicit_target',
      bypassFilters: true, // Explicit targets bypass pre-filters
    };
  }
  
  // Check global availability
  if (isGlobalJob(targets)) {
    return {
      shouldSee: true,
      matchSource: 'global_match',
      bypassFilters: false, // Global jobs go through normal filters
    };
  }
  
  // Job is restricted to specific candidates and this candidate is not one of them
  return {
    shouldSee: false,
    matchSource: 'global_match',
    bypassFilters: false,
  };
}

