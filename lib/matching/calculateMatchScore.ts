/**
 * Calculate Match Score
 * 
 * Deterministic scoring engine for job-candidate matching.
 * Returns a score from 0-100 with detailed breakdown.
 * 
 * NON-NEGOTIABLE: No AI, no embeddings, no ML - pure deterministic logic.
 */

export type Job = {
  title?: string;
  skills?: string[] | null;
  required_years_experience?: number | null;
  required_degree?: string | null;
  pay_rate_min?: number | null;
  pay_rate_max?: number | null;
  salary?: string | null;
  description?: string | null;
  [key: string]: any;
};

export type CandidateProfile = {
  skills?: string[] | null;
  experience_years?: number | null;
  expected_pay_min?: number | null;
  rate_expectation?: string | null;
  degrees?: string[] | null;
  certifications?: string[] | null;
  [key: string]: any;
};

export type ScoreBreakdown = {
  skills: number;
  jobTitle: number;
  experience: number;
  degree: number;
  pay: number;
  total: number;
};

/**
 * Extract numeric pay rate from salary string
 * Handles formats like "$80/hr", "$80/hour", "$80k", "$80,000", etc.
 */
function extractPayRate(salary: string | null | undefined): number | null {
  if (!salary) return null;

  const text = String(salary).toLowerCase().trim();
  
  // Extract hourly rate (e.g., "$80/hr", "$80/hour", "$80 per hour")
  const hourlyMatch = text.match(/\$?(\d+)\s*(?:per\s*)?(?:hr|hour)/);
  if (hourlyMatch) {
    return parseInt(hourlyMatch[1], 10);
  }

  // Extract annual salary (e.g., "$80k", "$80,000", "$80000")
  const annualMatch = text.match(/\$?(\d+(?:,\d{3})*(?:k)?)/);
  if (annualMatch) {
    let value = annualMatch[1].replace(/,/g, '');
    if (value.endsWith('k')) {
      value = value.slice(0, -1) + '000';
    }
    const num = parseInt(value, 10);
    // Convert annual to hourly (divide by 2080 hours/year)
    if (num > 1000) {
      return Math.round(num / 2080);
    }
    return num;
  }

  return null;
}

/**
 * Score: Skill Match (Max 25 points)
 * ≥3 skills match → +25
 * 2 skills → +15
 * 1 skill → +5
 */
function scoreSkills(job: Job, candidate: CandidateProfile): number {
  const jobSkills = Array.isArray(job.skills) 
    ? job.skills.map(s => String(s).toLowerCase().trim())
    : [];
  
  const candidateSkills = Array.isArray(candidate.skills)
    ? candidate.skills.map(s => String(s).toLowerCase().trim())
    : [];

  if (jobSkills.length === 0 || candidateSkills.length === 0) {
    return 0;
  }

  // Count matching skills
  const matches = jobSkills.filter(js => 
    candidateSkills.some(cs => cs === js || cs.includes(js) || js.includes(cs))
  ).length;

  if (matches >= 3) return 25;
  if (matches === 2) return 15;
  if (matches === 1) return 5;
  return 0;
}

/**
 * Score: Job Title Match (Max 25 points)
 * Tokenize title, ignore common words, match against candidate skills
 */
function scoreJobTitle(job: Job, candidate: CandidateProfile): number {
  if (!job.title) return 0;

  const ignoreWords = new Set([
    'developer', 'engineer', 'architect', 'consultant', 
    'lead', 'senior', 'junior', 'manager', 'specialist',
    'analyst', 'administrator', 'coordinator', 'assistant'
  ]);

  // Tokenize job title
  const titleTokens = job.title
    .toLowerCase()
    .split(/[\s\-_\/]+/)
    .map(t => t.trim())
    .filter(t => t.length > 2 && !ignoreWords.has(t));

  if (titleTokens.length === 0) return 0;

  const candidateSkills = Array.isArray(candidate.skills)
    ? candidate.skills.map(s => String(s).toLowerCase().trim())
    : [];

  // Check if any token matches a candidate skill
  const hasMatch = titleTokens.some(token =>
    candidateSkills.some(skill => 
      skill === token || skill.includes(token) || token.includes(skill)
    )
  );

  return hasMatch ? 25 : 0;
}

/**
 * Score: Experience (Max 20 points, can be negative)
 * Candidate ≥ required → +20
 * Within 1 year → +10
 * Missing by >2 years → −25
 */
function scoreExperience(job: Job, candidate: CandidateProfile): number {
  const required = job.required_years_experience;
  const candidateExp = candidate.experience_years || 0;

  if (required === null || required === undefined) {
    return 0; // No requirement specified
  }

  if (candidateExp >= required) {
    return 20;
  }

  const diff = required - candidateExp;
  if (diff <= 1) {
    return 10;
  }

  if (diff > 2) {
    return -25; // Penalty for significant gap
  }

  return 0;
}

/**
 * Score: Degree / Certification (Max 20 points, can be negative)
 * Required & present → +20
 * Preferred & present → +10
 * Required & missing → −10
 */
function scoreDegree(job: Job, candidate: CandidateProfile): number {
  const required = job.required_degree;
  if (!required) {
    return 0; // No degree requirement
  }

  const candidateDegrees = Array.isArray(candidate.degrees)
    ? candidate.degrees.map(d => String(d).toLowerCase().trim())
    : [];
  
  const candidateCerts = Array.isArray(candidate.certifications)
    ? candidate.certifications.map(c => String(c).toLowerCase().trim())
    : [];

  const allCredentials = [...candidateDegrees, ...candidateCerts];
  const requiredLower = String(required).toLowerCase().trim();

  // Check if candidate has the required degree/certification
  const hasMatch = allCredentials.some(cred =>
    cred === requiredLower || cred.includes(requiredLower) || requiredLower.includes(cred)
  );

  if (hasMatch) {
    return 20; // Required and present
  }

  return -10; // Required but missing
}

/**
 * Score: Pay Rate (Max 10 points, can be negative)
 * Mentioned and ≥ expectation → +10
 * Mentioned and below → −10
 * Missing → 0
 */
function scorePayRate(job: Job, candidate: CandidateProfile): number {
  // Try to get pay rate from structured fields first
  let jobPayRate: number | null = null;
  
  if (job.pay_rate_min !== null && job.pay_rate_min !== undefined) {
    jobPayRate = Number(job.pay_rate_min);
  } else if (job.pay_rate_max !== null && job.pay_rate_max !== undefined) {
    jobPayRate = Number(job.pay_rate_max);
  } else if (job.salary) {
    jobPayRate = extractPayRate(job.salary);
  }

  if (jobPayRate === null) {
    return 0; // No pay rate mentioned
  }

  // Get candidate expectation
  let candidateMinPay: number | null = null;
  
  if (candidate.expected_pay_min !== null && candidate.expected_pay_min !== undefined) {
    candidateMinPay = Number(candidate.expected_pay_min);
  } else if (candidate.rate_expectation) {
    candidateMinPay = extractPayRate(candidate.rate_expectation);
  }

  if (candidateMinPay === null) {
    return 0; // No expectation specified
  }

  if (jobPayRate >= candidateMinPay) {
    return 10; // Meets or exceeds expectation
  }

  return -10; // Below expectation
}

/**
 * Calculate total match score for a job-candidate pair
 */
export function calculateMatchScore(
  job: Job,
  candidate: CandidateProfile
): { score: number; breakdown: ScoreBreakdown } {
  const skillsScore = scoreSkills(job, candidate);
  const jobTitleScore = scoreJobTitle(job, candidate);
  const experienceScore = scoreExperience(job, candidate);
  const degreeScore = scoreDegree(job, candidate);
  const payScore = scorePayRate(job, candidate);

  const total = skillsScore + jobTitleScore + experienceScore + degreeScore + payScore;

  // Clamp score to 0-100 range
  const clampedScore = Math.max(0, Math.min(100, total));

  return {
    score: clampedScore,
    breakdown: {
      skills: skillsScore,
      jobTitle: jobTitleScore,
      experience: experienceScore,
      degree: degreeScore,
      pay: payScore,
      total: clampedScore,
    },
  };
}

