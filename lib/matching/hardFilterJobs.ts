/**
 * Hard Filter Jobs
 * 
 * Mandatory filtering rules that eliminate ineligible jobs.
 * Jobs that fail these filters are discarded immediately (no scoring).
 * 
 * NON-NEGOTIABLE: These are deterministic rules, not AI-based.
 */

export type Job = {
  id?: string;
  title: string;
  company: string;
  location: string;
  job_type?: string | null;
  is_remote?: boolean | null;
  [key: string]: any;
};

export type CandidateProfile = {
  id?: string;
  location?: string | null;
  preferred_job_types?: string[] | null;
  work_mode?: string[] | null;
  [key: string]: any;
};

export type FilterResult = {
  passed: boolean;
  reason?: string;
};

/**
 * Hard filter: Location must match OR job is remote
 */
function filterByLocation(job: Job, candidate: CandidateProfile): FilterResult {
  // If job is remote, always pass
  if (job.is_remote === true) {
    return { passed: true };
  }

  // If candidate has no location preference, pass all non-remote jobs
  if (!candidate.location) {
    return { passed: true };
  }

  // Normalize locations for comparison
  const jobLocation = (job.location || '').toLowerCase().trim();
  const candidateLocation = (candidate.location || '').toLowerCase().trim();

  // Extract city/state from location strings
  // Handle formats like "New York, NY", "San Francisco, CA", "Remote", etc.
  if (jobLocation.includes('remote') || jobLocation.includes('anywhere')) {
    return { passed: true };
  }

  // Simple matching: check if candidate location appears in job location
  // This handles cases like "New York" matching "New York, NY"
  const candidateParts = candidateLocation.split(',').map(p => p.trim());
  const jobParts = jobLocation.split(',').map(p => p.trim());

  // Check if any candidate location part matches any job location part
  const hasMatch = candidateParts.some(cPart => 
    jobParts.some(jPart => jPart.includes(cPart) || cPart.includes(jPart))
  );

  if (hasMatch) {
    return { passed: true };
  }

  return {
    passed: false,
    reason: `Location mismatch: job is in "${job.location}" but candidate prefers "${candidate.location}" and job is not remote`,
  };
}

/**
 * Hard filter: Job type must exist in candidate's selected job types
 */
function filterByJobType(job: Job, candidate: CandidateProfile): FilterResult {
  // If candidate has no job type preferences, pass all jobs
  if (!candidate.preferred_job_types || candidate.preferred_job_types.length === 0) {
    return { passed: true };
  }

  // If job has no job_type, fail (we need explicit job types for filtering)
  if (!job.job_type) {
    return {
      passed: false,
      reason: `Job missing job_type field`,
    };
  }

  // Normalize job types for comparison
  const jobType = (job.job_type || '').toLowerCase().trim();
  const preferredTypes = (candidate.preferred_job_types || []).map(t => 
    String(t).toLowerCase().trim()
  );

  if (preferredTypes.includes(jobType)) {
    return { passed: true };
  }

  return {
    passed: false,
    reason: `Job type "${job.job_type}" not in candidate's preferred types: ${preferredTypes.join(', ')}`,
  };
}

/**
 * Apply all hard filters to a job
 * Returns null if job fails any filter, otherwise returns the job
 */
export function hardFilterJobs(
  jobs: Job[],
  candidate: CandidateProfile
): { passed: Job[]; filtered: Array<{ job: Job; reason: string }> } {
  const passed: Job[] = [];
  const filtered: Array<{ job: Job; reason: string }> = [];

  for (const job of jobs) {
    // Apply location filter
    const locationResult = filterByLocation(job, candidate);
    if (!locationResult.passed) {
      filtered.push({ job, reason: locationResult.reason || 'Location filter failed' });
      continue;
    }

    // Apply job type filter
    const jobTypeResult = filterByJobType(job, candidate);
    if (!jobTypeResult.passed) {
      filtered.push({ job, reason: jobTypeResult.reason || 'Job type filter failed' });
      continue;
    }

    // Job passed all hard filters
    passed.push(job);
  }

  return { passed, filtered };
}

