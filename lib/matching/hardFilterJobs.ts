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
  location_type?: 'Onsite' | 'Hybrid' | 'Remote' | null;
  required_years_experience?: number | null;
  pay_rate_min?: number | null;
  pay_rate_max?: number | null;
  [key: string]: any;
};

export type CandidateProfile = {
  id?: string;
  location?: string | null;
  preferred_job_types?: string[] | null;
  work_mode?: string[] | null;
  experience_years?: number | null;
  expected_pay_min?: number | null;
  rate_expectation?: string | null;
  [key: string]: any;
};

export type FilterResult = {
  passed: boolean;
  reason?: string;
};

/**
 * Hard filter: Location must match OR job is remote/hybrid
 * 
 * Rules:
 * - Remote → always allowed
 * - Hybrid/Onsite → must match candidate city
 */
function filterByLocation(job: Job, candidate: CandidateProfile): FilterResult {
  // Check location_type first (new field)
  if (job.location_type === 'Remote') {
    return { passed: true };
  }

  // Fallback to is_remote flag
  if (job.is_remote === true) {
    return { passed: true };
  }

  // If candidate has no location preference, pass all non-remote jobs
  if (!candidate.location) {
    return { passed: true };
  }

  // For Hybrid/Onsite jobs, location must match
  const jobLocation = (job.location || '').toLowerCase().trim();
  const candidateLocation = (candidate.location || '').toLowerCase().trim();

  // Extract city from location strings (handle "New York, NY" format)
  if (jobLocation.includes('remote') || jobLocation.includes('anywhere')) {
    return { passed: true };
  }

  // Extract city name (before comma) for matching
  const candidateCity = candidateLocation.split(',')[0].trim();
  const jobCity = jobLocation.split(',')[0].trim();

  // Check if candidate city matches job city
  if (jobCity.includes(candidateCity) || candidateCity.includes(jobCity)) {
    return { passed: true };
  }

  return {
    passed: false,
    reason: `Location mismatch: job is ${job.location_type || 'Onsite'} in "${job.location}" but candidate is in "${candidate.location}"`,
  };
}

/**
 * Hard filter: Job type must exist in candidate's selected job types
 * 
 * Rules:
 * - Treat 1099 and C2C as equivalent
 * - Full-time only if explicitly selected
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
  let jobType = (job.job_type || '').toLowerCase().trim();
  const preferredTypes = (candidate.preferred_job_types || []).map(t => 
    String(t).toLowerCase().trim()
  );

  // Treat 1099 and C2C as equivalent
  if (jobType === '1099') {
    jobType = 'c2c';
  }
  if (jobType === 'c2c') {
    // Check if candidate has either 1099 or c2c
    if (preferredTypes.includes('1099') || preferredTypes.includes('c2c')) {
      return { passed: true };
    }
  }

  if (preferredTypes.includes(jobType)) {
    return { passed: true };
  }

  return {
    passed: false,
    reason: `Job type "${job.job_type}" not in candidate's preferred types: ${preferredTypes.join(', ')}`,
  };
}

/**
 * Hard filter: Experience + Rate
 * Candidate years ≥ job required years
 * Job rate ≥ candidate expectation
 */
function filterByExperienceAndRate(job: Job, candidate: CandidateProfile): FilterResult {
  // Check experience requirement
  if (job.required_years_experience !== null && job.required_years_experience !== undefined) {
    const candidateExp = candidate.experience_years || 0;
    if (candidateExp < job.required_years_experience) {
      return {
        passed: false,
        reason: `Experience mismatch: job requires ${job.required_years_experience} years but candidate has ${candidateExp} years`,
      };
    }
  }

  // Check pay rate
  const jobPayRate = job.pay_rate_min || job.pay_rate_max;
  if (jobPayRate !== null && jobPayRate !== undefined) {
    const candidateMinPay = candidate.expected_pay_min;
    if (candidateMinPay !== null && candidateMinPay !== undefined) {
      if (jobPayRate < candidateMinPay) {
        return {
          passed: false,
          reason: `Pay rate mismatch: job pays $${jobPayRate}/hr but candidate expects $${candidateMinPay}/hr`,
        };
      }
    }
  }

  return { passed: true };
}

/**
 * Apply all hard filters to a job
 * Returns null if job fails any filter, otherwise returns the job
 * 
 * ALL filters must pass for a job to be eligible.
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

    // Apply experience + rate filter
    const experienceRateResult = filterByExperienceAndRate(job, candidate);
    if (!experienceRateResult.passed) {
      filtered.push({ job, reason: experienceRateResult.reason || 'Experience/Rate filter failed' });
      continue;
    }

    // Job passed all hard filters
    passed.push(job);
  }

  return { passed, filtered };
}

