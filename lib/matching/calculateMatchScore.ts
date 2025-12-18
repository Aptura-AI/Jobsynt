/**
 * Calculate Match Score
 * 
 * Deterministic scoring engine for job-candidate matching.
 * 
 * Scoring breakdown (max 80 points):
 * - Skills: 50 points (40 for must_have_skills, 10 for good_to_have_skills)
 * - Experience: 10 points (candidate >= required OR within 10% margin)
 * - Degree: +10 if matches or not mentioned, -10 if required but missing
 * - Pay Rate: +10 if within 25% or not mentioned, -10 if outside range
 * 
 * Threshold: 50 points to pass
 * 
 * NON-NEGOTIABLE: No AI, no embeddings, no ML - pure deterministic logic.
 */

export type Job = {
  title?: string;
  skills?: string[] | null;
  must_have_skills?: string | null; // Comma-separated string
  good_to_have_skills?: string | null; // Comma-separated string
  required_years_experience?: number | null;
  required_degree?: string | null;
  education_required?: string | null;
  certification_required?: string | null;
  pay_rate_min?: number | null;
  pay_rate_max?: number | null;
  salary?: string | null;
  description?: string | null;
  [key: string]: any;
};

export type CandidateProfile = {
  skills?: string[] | null;
  primary_skills?: string[] | null;
  secondary_skills?: string[] | null;
  resume_text?: string | null;
  summary?: string | null;
  experience_years?: number | null;
  expected_pay_min?: number | null;
  rate_expectation?: string | null;
  degrees?: string[] | null;
  certifications?: string[] | null;
  [key: string]: any;
};

export type ScoreBreakdown = {
  skills: number;
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
 * Score: Skill Match (Max 50 points)
 * 
 * Rules:
 * - 40 points for matching must_have_skills with candidate's primary/secondary skills
 * - 10 points for matching good_to_have_skills
 * - Match against: primary_skills, secondary_skills, legacy skills array
 */
function scoreSkills(job: Job, candidate: CandidateProfile): number {
  let score = 0;

  // Build candidate skills from primary, secondary, and legacy skills
  const candidateSkills: string[] = [];
  
  if (Array.isArray(candidate.primary_skills)) {
    candidateSkills.push(...candidate.primary_skills.map(s => String(s).toLowerCase().trim()));
  }
  if (Array.isArray(candidate.secondary_skills)) {
    candidateSkills.push(...candidate.secondary_skills.map(s => String(s).toLowerCase().trim()));
  }
  if (Array.isArray(candidate.skills)) {
    candidateSkills.push(...candidate.skills.map(s => String(s).toLowerCase().trim()));
  }

  // Get must_have_skills (comma-separated string)
  const mustHaveSkillsStr = job.must_have_skills || '';
  const mustHaveSkills = mustHaveSkillsStr
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);

  // Get good_to_have_skills (comma-separated string)
  const goodToHaveSkillsStr = job.good_to_have_skills || '';
  const goodToHaveSkills = goodToHaveSkillsStr
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);

  // Score must_have_skills (40 points max)
  if (mustHaveSkills.length > 0 && candidateSkills.length > 0) {
    const matchedMustHave = mustHaveSkills.filter(requiredSkill => {
      return candidateSkills.some(cs => 
        cs === requiredSkill || cs.includes(requiredSkill) || requiredSkill.includes(cs)
      );
    });

    const matchPercentage = (matchedMustHave.length / mustHaveSkills.length);
    // Scale to 40 points based on match percentage
    score += Math.round(matchPercentage * 40);
  }

  // Score good_to_have_skills (10 points max)
  if (goodToHaveSkills.length > 0 && candidateSkills.length > 0) {
    const matchedGoodToHave = goodToHaveSkills.filter(optionalSkill => {
      return candidateSkills.some(cs => 
        cs === optionalSkill || cs.includes(optionalSkill) || optionalSkill.includes(cs)
      );
    });

    if (matchedGoodToHave.length > 0) {
      const matchPercentage = (matchedGoodToHave.length / goodToHaveSkills.length);
      // Scale to 10 points based on match percentage
      score += Math.round(matchPercentage * 10);
    }
  }

  return Math.min(score, 50); // Cap at 50 points
}

/**
 * Score: Experience (Max 10 points)
 * 
 * Rules:
 * - +10 if candidate >= required OR within 10% margin
 * - +10 if no requirement specified
 * - 0 otherwise
 */
function scoreExperience(job: Job, candidate: CandidateProfile): number {
  const required = job.required_years_experience;
  const candidateExp = candidate.experience_years || 0;

  // No requirement specified → +10 (default pass)
  if (required === null || required === undefined) {
    return 10;
  }

  // Candidate meets or exceeds requirement → +10
  if (candidateExp >= required) {
    return 10;
  }

  // Within 10% margin → +10
  const minRequired = required * 0.9;
  if (candidateExp >= minRequired) {
    return 10;
  }

  // Below threshold → 0
  return 0;
}

/**
 * Score: Degree / Certification (Can be +10 or -10)
 * 
 * Rules:
 * - +10 if matches OR not mentioned
 * - -10 if required but missing
 */
function scoreDegree(job: Job, candidate: CandidateProfile): number {
  const educationRequired = job.education_required || job.required_degree;
  const certificationRequired = job.certification_required;

  // No requirement specified → +10 (default pass)
  if (!educationRequired && !certificationRequired) {
    return 10;
  }

  const candidateDegrees = Array.isArray(candidate.degrees)
    ? candidate.degrees.map(d => String(d).toLowerCase().trim())
    : [];
  
  const candidateCerts = Array.isArray(candidate.certifications)
    ? candidate.certifications.map(c => String(c).toLowerCase().trim())
    : [];

  const allCredentials = [...candidateDegrees, ...candidateCerts];
  let hasMatch = false;

  // Check education requirement
  if (educationRequired) {
    const requiredLower = String(educationRequired).toLowerCase().trim();
    hasMatch = allCredentials.some(cred =>
      cred === requiredLower || cred.includes(requiredLower) || requiredLower.includes(cred)
    ) || (candidate.resume_text || '').toLowerCase().includes(requiredLower);
  }

  // Check certification requirement
  if (certificationRequired && !hasMatch) {
    const requiredLower = String(certificationRequired).toLowerCase().trim();
    hasMatch = candidateCerts.some(cert =>
      cert === requiredLower || cert.includes(requiredLower) || requiredLower.includes(cert)
    ) || (candidate.resume_text || '').toLowerCase().includes(requiredLower);
  }

  // Required and present → +10
  if (hasMatch) {
    return 10;
  }

  // Required but missing → -10
  return -10;
}

/**
 * Score: Pay Rate (Can be +10 or -10)
 * 
 * Rules:
 * - +10 if within 25% range OR not mentioned
 * - -10 if outside 25% range
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

  // No pay rate mentioned → +10 (default pass)
  if (jobPayRate === null) {
    return 10;
  }

  // Get candidate expectation
  let candidateMinPay: number | null = null;
  
  if (candidate.expected_pay_min !== null && candidate.expected_pay_min !== undefined) {
    candidateMinPay = Number(candidate.expected_pay_min);
  } else if (candidate.rate_expectation) {
    candidateMinPay = extractPayRate(candidate.rate_expectation);
  }

  // No candidate expectation → +10 (default pass)
  if (candidateMinPay === null) {
    return 10;
  }

  // Within 25% range (job pays at least 75% of expectation) → +10
  if (jobPayRate >= candidateMinPay * 0.75) {
    return 10;
  }

  // Outside 25% range → -10
  return -10;
}

/**
 * Calculate total match score for a job-candidate pair
 * 
 * Scoring breakdown (max 80 points):
 * - Skills: 0-50 points
 * - Experience: 0-10 points
 * - Degree: +10 or -10 points
 * - Pay Rate: +10 or -10 points
 * 
 * Threshold: 50 points to pass
 */
export function calculateMatchScore(
  job: Job,
  candidate: CandidateProfile
): { score: number; breakdown: ScoreBreakdown } {
  const skillsScore = scoreSkills(job, candidate);
  const experienceScore = scoreExperience(job, candidate);
  const degreeScore = scoreDegree(job, candidate);
  const payScore = scorePayRate(job, candidate);

  const total = skillsScore + experienceScore + degreeScore + payScore;

  // Clamp score to 0-80 range (can be negative due to -10 penalties)
  const clampedScore = Math.max(0, Math.min(80, total));

  return {
    score: clampedScore,
    breakdown: {
      skills: skillsScore,
      experience: experienceScore,
      degree: degreeScore,
      pay: payScore,
      total: clampedScore,
    },
  };
}
