/**
 * Lenient Pre-Filter for Job Matching
 * 
 * GOAL: Let jobs through, not block them.
 * This is Phase 1 of two-phase matching.
 * AI does the final ranking in Phase 2.
 * 
 * EXPLICIT TARGETING:
 * - If a job has target_candidate_ids that includes the candidate's ID,
 *   the job BYPASSES all pre-filters (recruiter intent is honored)
 * - Explicit targets are marked with match_source = "explicit_target"
 * 
 * GLOBAL JOBS (no explicit targeting):
 * A job passes if ALL of these are true (lenient rules):
 * - Location: Remote allowed, or same city, or candidate has no city
 * - Visa: UNSPECIFIED allows all, otherwise match or job has no visa requirement
 * - Experience: Candidate >= (job required - 1 year)
 * - Rate: Pass if job rate >= candidate expectation, or either is missing
 * - Skills: At least 30% overlap (very lenient)
 */

import { shouldCandidateSeeJob } from './targetCandidates';

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
  visa_requirement?: string | null;
  skills?: string[] | null;
  required_skills?: string | null;
  must_have_skills?: string | null;
  description?: string | null;
  target_candidate_ids?: string | null; // Recruiter-targeted candidate UUIDs
  [key: string]: any;
};

export type MatchSource = 'explicit_target' | 'global_match';

export type CandidateProfile = {
  id?: string;
  location?: string | null;
  preferred_job_types?: string[] | null;
  work_mode?: string[] | null;
  experience_years?: number | null;
  expected_pay_min?: number | null;
  rate_expectation?: string | null;
  visa_status?: string | null;
  skills?: string[] | null;
  // Structured skills
  primary_skills?: string[] | null;
  secondary_skills?: string[] | null;
  adjacent_skills?: string[] | null;
  generic_skills?: string[] | null;
  resume_text?: string | null;
  summary?: string | null;
  [key: string]: any;
};

export type FilterResult = {
  passed: boolean;
  reason?: string;
  stage?: string;
};

export type RejectionLog = {
  job_id: string | undefined;
  candidate_id: string | undefined;
  rejected_at_stage: 'pre-filter';
  reason: 'location_mismatch' | 'job_type_mismatch' | 'visa_block' | 'experience_mismatch' | 'skills_below_threshold' | 'rate_mismatch' | 'not_targeted';
  details: string;
};

export type PassedJob = Job & {
  match_source: MatchSource;
};

/**
 * LENIENT Location Filter
 * - Remote → always allowed
 * - If candidate has no location → allow Remote only
 * - Hybrid/Onsite → same city (lenient matching)
 */
function filterByLocation(job: Job, candidate: CandidateProfile): FilterResult {
  // Remote jobs always pass
  if (job.location_type === 'Remote' || job.is_remote === true) {
    return { passed: true };
  }

  // Check location string for remote keywords
  const jobLocation = (job.location || '').toLowerCase().trim();
  if (jobLocation.includes('remote') || jobLocation.includes('anywhere') || jobLocation.includes('work from home')) {
    return { passed: true };
  }

  // If candidate has no location, only allow remote jobs
  if (!candidate.location || candidate.location.trim() === '') {
    return {
      passed: false,
      reason: 'location_mismatch',
      stage: 'Candidate has no location set - only remote jobs allowed',
    };
  }

  // For Hybrid/Onsite, do lenient city matching
  const candidateLocation = (candidate.location || '').toLowerCase().trim();
  const candidateCity = candidateLocation.split(',')[0].trim();
  const jobCity = jobLocation.split(',')[0].trim();

  // Lenient matching: check if either contains the other
  if (
    jobCity.includes(candidateCity) || 
    candidateCity.includes(jobCity) ||
    jobLocation.includes(candidateCity) ||
    candidateLocation.includes(jobCity)
  ) {
    return { passed: true };
  }

  // Also pass if job location is vague/broad
  if (jobCity.length < 3 || jobLocation.includes('multiple') || jobLocation.includes('various')) {
    return { passed: true };
  }

  return {
    passed: false,
    reason: 'location_mismatch',
    stage: `Job is ${job.location_type || 'Onsite'} in "${job.location}" but candidate is in "${candidate.location}"`,
  };
}

/**
 * LENIENT Job Type Filter
 * - If candidate has no preferences → allow all
 * - 1099 and C2C are equivalent
 * - If job has no type → allow (don't reject on missing data)
 */
function filterByJobType(job: Job, candidate: CandidateProfile): FilterResult {
  // If candidate has no preferences, allow all jobs
  if (!candidate.preferred_job_types || candidate.preferred_job_types.length === 0) {
    return { passed: true };
  }

  // If job has no type, PASS (lenient - don't reject missing data)
  if (!job.job_type) {
    return { passed: true };
  }

  // Normalize job types
  let jobType = (job.job_type || '').toLowerCase().trim();
  const preferredTypes = (candidate.preferred_job_types || []).map(t => 
    String(t).toLowerCase().trim()
  );

  // 1099 and C2C equivalence
  if (jobType === '1099' || jobType === 'c2c') {
    if (preferredTypes.includes('1099') || preferredTypes.includes('c2c')) {
      return { passed: true };
    }
  }

  // Direct match
  if (preferredTypes.includes(jobType)) {
    return { passed: true };
  }

  // Partial match (e.g., "full-time" matches "full time")
  const normalizedJobType = jobType.replace(/[-_\s]/g, '');
  for (const pref of preferredTypes) {
    if (pref.replace(/[-_\s]/g, '') === normalizedJobType) {
      return { passed: true };
    }
  }

  return {
    passed: false,
    reason: 'job_type_mismatch',
    stage: `Job type "${job.job_type}" not in candidate's preferred types: ${preferredTypes.join(', ')}`,
  };
}

/**
 * LENIENT Visa Filter
 * - UNSPECIFIED → allow ALL jobs
 * - If job has no visa requirement → allow
 * - Otherwise, match candidate visa to job requirement
 */
function filterByVisa(job: Job, candidate: CandidateProfile): FilterResult {
  const candidateVisa = (candidate.visa_status || 'UNSPECIFIED').toUpperCase().trim();

  // UNSPECIFIED allows all jobs
  if (candidateVisa === 'UNSPECIFIED' || candidateVisa === '') {
    return { passed: true };
  }

  // If job has no visa requirement, allow
  if (!job.visa_requirement || job.visa_requirement.trim() === '') {
    return { passed: true };
  }

  // Normalize job visa requirement
  const jobVisa = job.visa_requirement.toUpperCase().trim();

  // US Citizen and Green Card can work any job
  if (candidateVisa === 'US_CITIZEN' || candidateVisa === 'GREEN_CARD') {
    return { passed: true };
  }

  // Check if job allows candidate's visa
  if (jobVisa.includes(candidateVisa) || jobVisa.includes('ANY') || jobVisa.includes('ALL')) {
    return { passed: true };
  }

  // H1B/EAD/TN can work most jobs unless explicitly restricted to citizens
  if (['H1B', 'EAD', 'TN', 'F1'].includes(candidateVisa)) {
    if (!jobVisa.includes('CITIZEN') && !jobVisa.includes('US ONLY') && !jobVisa.includes('CLEARANCE')) {
      return { passed: true };
    }
  }

  return {
    passed: false,
    reason: 'visa_block',
    stage: `Job requires "${job.visa_requirement}" but candidate has "${candidate.visa_status}"`,
  };
}

/**
 * LENIENT Experience Filter
 * - Candidate >= (job required - 1 year)
 * - If job has no requirement → pass
 */
function filterByExperience(job: Job, candidate: CandidateProfile): FilterResult {
  // If job has no experience requirement, pass
  if (job.required_years_experience === null || job.required_years_experience === undefined) {
    return { passed: true };
  }

  const candidateExp = candidate.experience_years || 0;
  const requiredExp = job.required_years_experience;

  // Lenient: allow 1 year less than required
  if (candidateExp >= requiredExp - 1) {
    return { passed: true };
  }

  return {
    passed: false,
    reason: 'experience_mismatch',
    stage: `Job requires ${requiredExp} years but candidate has ${candidateExp} years`,
  };
}

/**
 * SOFT Rate Filter
 * - Pass if job rate >= candidate expectation
 * - Pass if either rate is missing
 * - DO NOT reject on rate alone
 */
function filterByRate(job: Job, candidate: CandidateProfile): FilterResult {
  // If job has no rate info, pass
  const jobRate = job.pay_rate_min || job.pay_rate_max;
  if (jobRate === null || jobRate === undefined) {
    return { passed: true };
  }

  // Parse candidate rate expectation
  let candidateMinPay = candidate.expected_pay_min;
  if (candidateMinPay === null || candidateMinPay === undefined) {
    // Try to parse from rate_expectation string
    if (candidate.rate_expectation) {
      const match = candidate.rate_expectation.match(/\d+/);
      if (match) {
        candidateMinPay = parseInt(match[0], 10);
      }
    }
  }

  // If candidate has no rate expectation, pass
  if (candidateMinPay === null || candidateMinPay === undefined) {
    return { passed: true };
  }

  // Lenient: allow 10% below expectation
  if (jobRate >= candidateMinPay * 0.9) {
    return { passed: true };
  }

  // SOFT PASS - don't reject on rate alone, just note it
  return { passed: true }; // Changed to pass - rate should not block
}

/**
 * LENIENT Skills Filter
 * - At least 30% overlap required
 * - Matches against: job skills, candidate skills, resume_text, summary
 */
function filterBySkills(job: Job, candidate: CandidateProfile): FilterResult {
  // Extract job skills
  const jobSkillsArray: string[] = [];
  
  if (Array.isArray(job.skills)) {
    jobSkillsArray.push(...job.skills);
  }
  if (job.required_skills) {
    jobSkillsArray.push(...job.required_skills.split(/[,;|]/));
  }
  if (job.must_have_skills) {
    jobSkillsArray.push(...job.must_have_skills.split(/[,;|]/));
  }

  // Normalize job skills
  const normalizedJobSkills = jobSkillsArray
    .map(s => s.toLowerCase().trim())
    .filter(s => s.length > 1);

  // If job has no skills defined, pass
  if (normalizedJobSkills.length === 0) {
    return { passed: true };
  }

  // Build candidate skills corpus
  const candidateCorpus: string[] = [];
  
  if (Array.isArray(candidate.skills)) {
    candidateCorpus.push(...candidate.skills.map(s => s.toLowerCase().trim()));
  }
  if (candidate.resume_text) {
    candidateCorpus.push(candidate.resume_text.toLowerCase());
  }
  if (candidate.summary) {
    candidateCorpus.push(candidate.summary.toLowerCase());
  }

  const candidateText = candidateCorpus.join(' ');

  // Count matches
  let matchCount = 0;
  for (const skill of normalizedJobSkills) {
    // Check direct match or partial match in corpus
    if (candidateCorpus.includes(skill) || candidateText.includes(skill)) {
      matchCount++;
    }
  }

  const matchRatio = matchCount / normalizedJobSkills.length;

  // Lenient: 30% match threshold
  if (matchRatio >= 0.3) {
    return { passed: true };
  }

  // If very few skills required (1-2), require at least 1 match
  if (normalizedJobSkills.length <= 2 && matchCount >= 1) {
    return { passed: true };
  }

  return {
    passed: false,
    reason: 'skills_below_threshold',
    stage: `Only ${Math.round(matchRatio * 100)}% skill match (${matchCount}/${normalizedJobSkills.length}). Need 30%+`,
  };
}

/**
 * Apply LENIENT pre-filter to jobs
 * 
 * Goal: Let jobs through to AI for ranking
 * 
 * EXPLICIT TARGETING OVERRIDE:
 * - If candidate is in job.target_candidate_ids → BYPASS all filters
 * - Mark as match_source = "explicit_target"
 * - Recruiter intent is ALWAYS honored
 * 
 * Returns both passed jobs and rejection logs for debugging
 */
export function lenientPreFilter(
  jobs: Job[],
  candidate: CandidateProfile
): { 
  passed: PassedJob[]; 
  filtered: Array<{ job: Job; reason: string }>; 
  rejectionLogs: RejectionLog[];
  explicitTargetCount: number;
  globalMatchCount: number;
} {
  const passed: PassedJob[] = [];
  const filtered: Array<{ job: Job; reason: string }> = [];
  const rejectionLogs: RejectionLog[] = [];
  let explicitTargetCount = 0;
  let globalMatchCount = 0;

  const candidateId = candidate.id || '';

  for (const job of jobs) {
    // STEP 1: Check explicit targeting (BYPASSES ALL FILTERS)
    const targetCheck = shouldCandidateSeeJob(job, candidateId);
    
    if (targetCheck.matchSource === 'explicit_target') {
      // Recruiter explicitly targeted this candidate - ALWAYS include
      passed.push({
        ...job,
        match_source: 'explicit_target',
      });
      explicitTargetCount++;
      console.log(`[Explicit Target] Job "${job.title}" at ${job.company} → Candidate ${candidateId.substring(0, 8)}...`);
      continue;
    }
    
    // If job is restricted to specific candidates and this candidate is not one of them
    if (!targetCheck.shouldSee) {
      filtered.push({ job, reason: 'Job restricted to specific candidates' });
      rejectionLogs.push({
        job_id: job.id,
        candidate_id: candidateId,
        rejected_at_stage: 'pre-filter',
        reason: 'not_targeted',
        details: 'Job is restricted to specific candidates and this candidate is not targeted',
      });
      continue;
    }

    // STEP 2: GLOBAL job - apply normal lenient filters
    let rejected = false;
    let rejectionReason: RejectionLog['reason'] | null = null;
    let rejectionDetails = '';

    // Apply filters in order (stop at first failure)
    const filters = [
      { fn: filterByLocation, name: 'location_mismatch' as const },
      { fn: filterByJobType, name: 'job_type_mismatch' as const },
      { fn: filterByVisa, name: 'visa_block' as const },
      { fn: filterByExperience, name: 'experience_mismatch' as const },
      { fn: filterByRate, name: 'rate_mismatch' as const },
      { fn: filterBySkills, name: 'skills_below_threshold' as const },
    ];

    for (const filter of filters) {
      const result = filter.fn(job, candidate);
      if (!result.passed) {
        rejected = true;
        rejectionReason = filter.name;
        rejectionDetails = result.stage || result.reason || filter.name;
        break;
      }
    }

    if (rejected && rejectionReason) {
      filtered.push({ job, reason: rejectionDetails });
      rejectionLogs.push({
        job_id: job.id,
        candidate_id: candidateId,
        rejected_at_stage: 'pre-filter',
        reason: rejectionReason,
        details: rejectionDetails,
      });
    } else {
      passed.push({
        ...job,
        match_source: 'global_match',
      });
      globalMatchCount++;
    }
  }

  // Log summary for debugging
  const passRate = jobs.length > 0 ? Math.round((passed.length / jobs.length) * 100) : 0;
  console.log(`[Lenient Pre-Filter] ${passed.length}/${jobs.length} jobs passed (${passRate}%)`);
  console.log(`[Lenient Pre-Filter] Breakdown: ${explicitTargetCount} explicit targets, ${globalMatchCount} global matches`);
  
  if (filtered.length > 0) {
    const reasonCounts: Record<string, number> = {};
    for (const log of rejectionLogs) {
      reasonCounts[log.reason] = (reasonCounts[log.reason] || 0) + 1;
    }
    console.log('[Lenient Pre-Filter] Rejection breakdown:', reasonCounts);
  }

  return { passed, filtered, rejectionLogs, explicitTargetCount, globalMatchCount };
}

// Export the old function name for backward compatibility
export { lenientPreFilter as hardFilterJobs };

