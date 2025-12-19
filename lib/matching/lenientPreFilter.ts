/**
 * Pre-Filter for Job Matching
 * 
 * This is Phase 1 of two-phase matching.
 * AI does the final ranking in Phase 2.
 * 
 * EXPLICIT TARGETING:
 * - If a job has target_candidate_ids that includes the candidate's ID,
 *   the job BYPASSES all pre-filters (recruiter intent is honored)
 * - Explicit targets are marked with match_source = "explicit_target"
 * 
 * GLOBAL JOBS (no explicit targeting):
 * A job passes if ALL of these are true:
 * - Location: Remote jobs always pass; non-remote must match candidate's city
 * - Job Type: Must match candidate's preferences (1099/C2C are equivalent)
 * - Visa: Always pass (handled by AI)
 * - Experience: 20% margin (job requires 10yr → candidate needs 8+)
 * - Rate: 25% margin (candidate expects $100 → job must pay $75+)
 * - Skills: At least ONE required skill in candidate's primary/secondary skills
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
  // Note: skills column removed - use must_have_skills and good_to_have_skills instead
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
 * Location Filter
 * - Remote jobs → ALWAYS PASS
 * - Non-remote jobs → Pass only if same city match
 */
function filterByLocation(job: Job, candidate: CandidateProfile): FilterResult {
  // PRIORITY 1: is_remote flag (explicit flag overrides location string)
  // If is_remote = true, job is ALWAYS treated as Remote regardless of location
  if (job.is_remote === true) {
    return { passed: true, reason: 'Remote job (is_remote flag set)' };
  }

  // PRIORITY 2: location_type enum
  if (job.location_type === 'Remote') {
    return { passed: true, reason: 'Remote job (location_type = Remote)' };
  }

  // PRIORITY 3: Check location string for remote keywords (fallback)
  const jobLocation = (job.location || '').toLowerCase().trim();
  if (jobLocation.includes('remote') || jobLocation.includes('anywhere') || jobLocation.includes('work from home')) {
    return { passed: true, reason: 'Remote job (location string contains remote keywords)' };
  }

  // If job has no location info, pass (can't filter without data)
  if (!job.location || job.location.trim() === '') {
    return { passed: true };
  }

  // If candidate has no location, reject non-remote jobs
  if (!candidate.location || candidate.location.trim() === '') {
    return {
      passed: false,
      reason: 'location_mismatch',
      stage: 'Candidate has no location set - only remote jobs allowed',
    };
  }

  // For Hybrid/Onsite, require same city match
  const candidateLocation = (candidate.location || '').toLowerCase().trim();
  const candidateCity = candidateLocation.split(',')[0].trim();
  const jobCity = jobLocation.split(',')[0].trim();

  // City matching: check if either contains the other
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
 * Job Type Filter
 * - If candidate has no preferences → allow all
 * - 1099 and C2C are EQUIVALENT - pass to anyone who selected either
 * - Full-time/W2 → pass only to those who selected them
 * - If job has no type → allow (can't filter without data)
 */
function filterByJobType(job: Job, candidate: CandidateProfile): FilterResult {
  // If candidate has no preferences, allow all jobs
  if (!candidate.preferred_job_types || candidate.preferred_job_types.length === 0) {
    return { passed: true };
  }

  // If job has no type, pass (can't filter without data)
  if (!job.job_type) {
    return { passed: true };
  }

  // Normalize job type
  const jobType = (job.job_type || '').toLowerCase().trim();
  const preferredTypes = (candidate.preferred_job_types || []).map(t => 
    String(t).toLowerCase().trim()
  );

  // 1099 and C2C are EQUIVALENT - pass to anyone who selected either
  const contractTypes = ['1099', 'c2c', 'contract'];
  const isJobContract = contractTypes.some(t => jobType.includes(t));
  const candidateWantsContract = preferredTypes.some(p => 
    contractTypes.some(t => p.includes(t))
  );
  
  if (isJobContract && candidateWantsContract) {
    return { passed: true };
  }

  // Full-time/W2 matching
  const fulltimeTypes = ['full-time', 'fulltime', 'full time', 'w2', 'permanent'];
  const isJobFulltime = fulltimeTypes.some(t => jobType.includes(t));
  const candidateWantsFulltime = preferredTypes.some(p => 
    fulltimeTypes.some(t => p.includes(t))
  );
  
  if (isJobFulltime && candidateWantsFulltime) {
    return { passed: true };
  }

  // Part-time matching
  const parttimeTypes = ['part-time', 'parttime', 'part time'];
  const isJobParttime = parttimeTypes.some(t => jobType.includes(t));
  const candidateWantsParttime = preferredTypes.some(p => 
    parttimeTypes.some(t => p.includes(t))
  );
  
  if (isJobParttime && candidateWantsParttime) {
    return { passed: true };
  }

  // Direct match (for any other types)
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
 * ULTRA-LENIENT Visa Filter
 * - ALWAYS PASS - let AI handle visa explanations
 * - AI will note if there's a potential visa issue
 * 
 * GOAL: Never block on visa. AI will explain requirements.
 */
function filterByVisa(job: Job, candidate: CandidateProfile): FilterResult {
  // ALWAYS PASS - we never reject on visa
  // AI will note visa requirements and explain any potential issues
  return { passed: true };
}

/**
 * Experience Filter
 * - 20% margin allowed (e.g., 10 years required → 8+ years passes)
 * - If job has no requirement → pass
 */
function filterByExperience(job: Job, candidate: CandidateProfile): FilterResult {
  // If job has no experience requirement, pass
  if (job.required_years_experience === null || job.required_years_experience === undefined) {
    return { passed: true };
  }

  const candidateExp = candidate.experience_years || 0;
  const requiredExp = job.required_years_experience;

  // 20% margin: candidate must have at least 80% of required experience
  const minRequired = requiredExp * 0.8;
  
  if (candidateExp >= minRequired) {
    return { passed: true };
  }

  return {
    passed: false,
    reason: 'experience_mismatch',
    stage: `Job requires ${requiredExp} years (min ${Math.ceil(minRequired)}) but candidate has ${candidateExp} years`,
  };
}

/**
 * Rate Filter
 * - Pass if job rate is within 25% of candidate expectation
 * - Pass if either rate is missing (can't filter without data)
 */
function filterByRate(job: Job, candidate: CandidateProfile): FilterResult {
  // If job has no rate info, pass (can't filter without data)
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

  // If candidate has no rate expectation, pass (can't filter without data)
  if (candidateMinPay === null || candidateMinPay === undefined) {
    return { passed: true };
  }

  // 25% margin: job rate must be at least 75% of candidate expectation
  const minAcceptable = candidateMinPay * 0.75;
  
  if (jobRate >= minAcceptable) {
    return { passed: true };
  }

  return {
    passed: false,
    reason: 'rate_mismatch',
    stage: `Job pays $${jobRate}/hr but candidate expects at least $${candidateMinPay}/hr (min acceptable: $${Math.ceil(minAcceptable)}/hr)`,
  };
}

/**
 * Skills Filter (CRITICAL)
 * 
 * Rules:
 * - If job has must_have_skills AND zero overlap → REJECT (unless explicit_target)
 * - If job has no must_have_skills → PASS (can't filter without data)
 * - Pass if ANY must_have skill matches candidate's primary/secondary/legacy skills
 * 
 * NOTE: Explicit targets bypass this filter entirely (handled in main filter loop)
 */
function filterBySkills(job: Job, candidate: CandidateProfile): FilterResult {
  // Extract job must_have_skills
  const requiredSkillsArray: string[] = [];
  
  if (job.must_have_skills) {
    requiredSkillsArray.push(...job.must_have_skills.split(/[,;|]/));
  }
  if (job.required_skills) {
    requiredSkillsArray.push(...job.required_skills.split(/[,;|]/));
  }
  // Fallback: If no must_have_skills, check good_to_have_skills
  if (requiredSkillsArray.length === 0 && job.good_to_have_skills) {
    requiredSkillsArray.push(...job.good_to_have_skills.split(/[,;|]/));
  }

  // Normalize required skills
  const normalizedRequiredSkills = requiredSkillsArray
    .map(s => s.toLowerCase().trim())
    .filter(s => s.length > 1);

  // If job has no must_have_skills defined → PASS (can't filter without data)
  if (normalizedRequiredSkills.length === 0) {
    return { passed: true };
  }

  // Build candidate skills from primary, secondary, and legacy arrays
  const candidateSkills: string[] = [];
  
  // Primary skills (highest priority)
  if (Array.isArray(candidate.primary_skills)) {
    candidateSkills.push(...candidate.primary_skills.map(s => s.toLowerCase().trim()));
  }
  // Secondary skills
  if (Array.isArray(candidate.secondary_skills)) {
    candidateSkills.push(...candidate.secondary_skills.map(s => s.toLowerCase().trim()));
  }
  // Legacy skills array (for backwards compatibility)
  if (Array.isArray(candidate.skills)) {
    candidateSkills.push(...candidate.skills.map(s => s.toLowerCase().trim()));
  }

  // If candidate has no skills defined → REJECT
  // (Job has must_have_skills but candidate has nothing to match)
  if (candidateSkills.length === 0) {
    return {
      passed: false,
      reason: 'skills_below_threshold',
      stage: 'Candidate has no skills defined. Job requires: ' + normalizedRequiredSkills.slice(0, 3).join(', '),
    };
  }

  // Check for ANY skill overlap
  let matchCount = 0;
  const matchedSkills: string[] = [];
  
  for (const requiredSkill of normalizedRequiredSkills) {
    const hasMatch = candidateSkills.some(candidateSkill => {
      return candidateSkill === requiredSkill || 
             candidateSkill.includes(requiredSkill) || 
             requiredSkill.includes(candidateSkill);
    });
    
    if (hasMatch) {
      matchCount++;
      matchedSkills.push(requiredSkill);
    }
  }

  // ZERO OVERLAP = REJECT (this is critical)
  // Unless explicit_target (which bypasses this filter entirely)
  if (matchCount === 0) {
    return {
      passed: false,
      reason: 'skills_below_threshold',
      stage: `Zero skill overlap. Job needs: ${normalizedRequiredSkills.slice(0, 5).join(', ')}. Candidate has: ${candidateSkills.slice(0, 5).join(', ')}`,
    };
  }

  // At least one match → PASS
  return { passed: true };
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

  // No safety net - quality over quantity
  // If no jobs pass filters, that's the correct behavior

  return { passed, filtered, rejectionLogs, explicitTargetCount, globalMatchCount };
}

// Export the old function name for backward compatibility
export { lenientPreFilter as hardFilterJobs };

