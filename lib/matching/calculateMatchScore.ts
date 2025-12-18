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
 * 
 * Rules:
 * - ≥80% match of must_have_skills → +25
 * - Match against: candidate skills list, resume text, summary text
 * - Good-to-have: 50% match → +10, 100% match → +20
 */
function scoreSkills(job: Job, candidate: CandidateProfile): number {
  let score = 0;

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

  // Build candidate skill sources: skills list, resume text, summary text
  const candidateSkills = Array.isArray(candidate.skills)
    ? candidate.skills.map(s => String(s).toLowerCase().trim())
    : [];
  
  const resumeText = (candidate.resume_text || '').toLowerCase();
  const summaryText = (candidate.summary || '').toLowerCase();
  const allCandidateText = `${resumeText} ${summaryText}`.toLowerCase();

  // Check must_have_skills match (≥80% required)
  if (mustHaveSkills.length > 0) {
    const matchedMustHave = mustHaveSkills.filter(requiredSkill => {
      // Check against skills list
      const inSkillsList = candidateSkills.some(cs => 
        cs === requiredSkill || cs.includes(requiredSkill) || requiredSkill.includes(cs)
      );
      
      // Check against resume/summary text
      const inText = allCandidateText.includes(requiredSkill);
      
      return inSkillsList || inText;
    });

    const matchPercentage = (matchedMustHave.length / mustHaveSkills.length) * 100;
    
    if (matchPercentage >= 80) {
      score += 25; // Full points for ≥80% match
    } else {
      // Partial credit for partial match
      score += Math.floor((matchPercentage / 80) * 25);
    }
  } else {
    // Fallback to old logic if must_have_skills not available
    const jobSkills = Array.isArray(job.skills) 
      ? job.skills.map(s => String(s).toLowerCase().trim())
      : [];

    if (jobSkills.length > 0 && candidateSkills.length > 0) {
      const matches = jobSkills.filter(js => 
        candidateSkills.some(cs => cs === js || cs.includes(js) || js.includes(cs))
      ).length;

      if (matches >= 3) score += 25;
      else if (matches === 2) score += 15;
      else if (matches === 1) score += 5;
    }
  }

  // Check good_to_have_skills match
  if (goodToHaveSkills.length > 0) {
    const matchedGoodToHave = goodToHaveSkills.filter(optionalSkill => {
      const inSkillsList = candidateSkills.some(cs => 
        cs === optionalSkill || cs.includes(optionalSkill) || optionalSkill.includes(cs)
      );
      const inText = allCandidateText.includes(optionalSkill);
      return inSkillsList || inText;
    });

    const matchPercentage = (matchedGoodToHave.length / goodToHaveSkills.length) * 100;
    
    if (matchPercentage >= 100) {
      score += 20; // 100% match → +20
    } else if (matchPercentage >= 50) {
      score += 10; // 50% match → +10
    }
  }

  return Math.min(score, 25); // Cap at 25 points
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
 * Score: Experience (Max 20 points)
 * Candidate ≥ required → +20
 * Within 20% (pre-filter allows this) → +15
 * Within 1 year → +10
 */
function scoreExperience(job: Job, candidate: CandidateProfile): number {
  const required = job.required_years_experience;
  const candidateExp = candidate.experience_years || 0;

  if (required === null || required === undefined) {
    return 10; // No requirement specified - neutral score
  }

  if (candidateExp >= required) {
    return 20; // Meets or exceeds
  }

  // Within 20% margin (which is what pre-filter allows)
  const minRequired = required * 0.8;
  if (candidateExp >= minRequired) {
    return 15;
  }

  const diff = required - candidateExp;
  if (diff <= 1) {
    return 10;
  }

  return 5; // Some experience is better than none
}

/**
 * Score: Degree / Certification (Max 20 points)
 * 
 * Rules:
 * - Only scored if job specifies education_required or certification_required
 * - Required & present → +20
 * - Required & missing → +5 (partial credit for other qualifications)
 * - No requirement → +10 (neutral)
 */
function scoreDegree(job: Job, candidate: CandidateProfile): number {
  // Check education_required first (new field)
  const educationRequired = job.education_required || job.required_degree;
  const certificationRequired = job.certification_required;

  if (!educationRequired && !certificationRequired) {
    return 10; // No requirement specified - neutral score
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
    ) || (candidate.resume_text || '').toLowerCase().includes(requiredLower.toLowerCase());
  }

  // Check certification requirement
  if (certificationRequired && !hasMatch) {
    const requiredLower = String(certificationRequired).toLowerCase().trim();
    hasMatch = candidateCerts.some(cert =>
      cert === requiredLower || cert.includes(requiredLower) || requiredLower.includes(cert)
    ) || (candidate.resume_text || '').toLowerCase().includes(requiredLower.toLowerCase());
  }

  if (hasMatch) {
    return 20; // Required and present
  }

  return 5; // Missing but may have equivalent experience
}

/**
 * Score: Pay Rate (Max 10 points)
 * Meets or exceeds expectation → +10
 * Within 25% margin (pre-filter allows this) → +7
 * Missing data → +5 (neutral)
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
    return 5; // No pay rate mentioned - neutral
  }

  // Get candidate expectation
  let candidateMinPay: number | null = null;
  
  if (candidate.expected_pay_min !== null && candidate.expected_pay_min !== undefined) {
    candidateMinPay = Number(candidate.expected_pay_min);
  } else if (candidate.rate_expectation) {
    candidateMinPay = extractPayRate(candidate.rate_expectation);
  }

  if (candidateMinPay === null) {
    return 5; // No expectation specified - neutral
  }

  if (jobPayRate >= candidateMinPay) {
    return 10; // Meets or exceeds expectation
  }

  // Within 25% margin (which is what pre-filter allows)
  if (jobPayRate >= candidateMinPay * 0.75) {
    return 7;
  }

  return 3; // Below expectation but passed filter
}

/**
 * Calculate total match score for a job-candidate pair
 * 
 * Scoring breakdown (max 100 points):
 * - Skills: 0-25 points
 * - Job Title: 0-25 points
 * - Experience: 0-20 points
 * - Degree/Cert: 0-20 points
 * - Pay Rate: 0-10 points
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

