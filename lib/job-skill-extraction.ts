/**
 * Job Skill Extraction Utility
 * 
 * Server-only module for extracting skills from job descriptions.
 * Uses deterministic pattern matching to identify skill-like phrases.
 * 
 * NO AI calls - purely heuristic-based extraction
 */

export type ExtractedSkills = {
  primary_skill: string | null;
  secondary_skills: string[];
};

/**
 * Normalize skill name to consistent casing
 * - Converts to title case (first letter uppercase, rest lowercase)
 * - Handles special cases like "SQL", "API", etc.
 */
function normalizeSkillName(skill: string): string {
  const trimmed = skill.trim();
  if (!trimmed) return trimmed;

  // Handle all caps acronyms (SQL, API, REST, etc.)
  if (trimmed.length <= 4 && trimmed === trimmed.toUpperCase()) {
    return trimmed;
  }

  // Handle hyphenated/camelCase skills
  if (trimmed.includes('-')) {
    return trimmed
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('-');
  }

  // Standard title case
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/**
 * Clean extracted skill text
 * - Removes common prefixes/suffixes
 * - Removes punctuation at ends
 * - Trims whitespace
 */
function cleanSkillText(text: string): string {
  // Remove trailing punctuation
  let cleaned = text.replace(/[.,;:!?]+$/, '').trim();

  // Remove common prefixes
  const prefixes = [
    /^(experience with|proficient in|knowledge of|familiarity with|expertise in|skilled in|working with|using|with|in)\s+/i,
    /^(the |a |an )/i,
  ];

  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, '');
  }

  // Remove common suffixes
  const suffixes = [
    /\s+(experience|skills?|knowledge|expertise|proficiency)$/i,
    /\s+(required|preferred|mandatory|essential)$/i,
  ];

  for (const suffix of suffixes) {
    cleaned = cleaned.replace(suffix, '');
  }

  return cleaned.trim();
}

/**
 * Extract capitalized words/phrases that likely represent skills
 * Looks for:
 * - Capitalized words (likely proper nouns/technologies)
 * - Phrases after skill indicators
 */
function extractCapitalizedSkills(text: string): string[] {
  const skills: string[] = [];
  const seen = new Set<string>();

  // Pattern 1: Capitalized words (likely technologies/tools)
  // Match words that start with capital letter and are 2+ characters
  const capitalizedWords = text.match(/\b[A-Z][a-zA-Z0-9]{1,}(?:\s+[A-Z][a-zA-Z0-9]{1,})*\b/g) || [];

  for (const word of capitalizedWords) {
    // Skip common non-skill capitalized words
    const skipWords = [
      'The', 'A', 'An', 'And', 'Or', 'But', 'In', 'On', 'At', 'To', 'For',
      'Of', 'With', 'From', 'By', 'This', 'That', 'These', 'Those',
      'Company', 'Team', 'Position', 'Role', 'Job', 'Required', 'Preferred',
      'Years', 'Year', 'Experience', 'Responsibilities', 'Requirements',
      'Must', 'Should', 'Will', 'Can', 'May', 'If', 'When', 'Where',
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      'January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December',
    ];

    const isSkipWord = skipWords.some(skip => 
      word === skip || word.startsWith(skip + ' ')
    );

    if (!isSkipWord && word.length >= 2) {
      const normalized = normalizeSkillName(word);
      if (normalized && normalized.length >= 2 && !seen.has(normalized.toLowerCase())) {
        skills.push(normalized);
        seen.add(normalized.toLowerCase());
      }
    }
  }

  return skills;
}

/**
 * Extract skills from patterns like "experience with X", "proficient in Y"
 */
function extractSkillsFromPatterns(text: string): string[] {
  const skills: string[] = [];
  const seen = new Set<string>();

  // Pattern: "experience with X", "proficient in Y", etc.
  const skillPatterns = [
    /(?:experience|proficient|knowledge|familiarity|expertise|skilled|working|using)\s+(?:with|in|of)\s+([A-Z][a-zA-Z0-9\s-]+?)(?:[,.;]|\s+and|\s+or|$)/gi,
    /([A-Z][a-zA-Z0-9\s-]+?)\s+(?:experience|skills?|knowledge|expertise)/gi,
  ];

  for (const pattern of skillPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const cleaned = cleanSkillText(match[1]);
        if (cleaned && cleaned.length >= 2) {
          const normalized = normalizeSkillName(cleaned);
          if (normalized && !seen.has(normalized.toLowerCase())) {
            skills.push(normalized);
            seen.add(normalized.toLowerCase());
          }
        }
      }
    }
  }

  return skills;
}

/**
 * Extract skills from bullet points or lists
 */
function extractSkillsFromLists(text: string): string[] {
  const skills: string[] = [];
  const seen = new Set<string>();

  // Match bullet points or numbered lists
  const listPattern = /(?:^|\n)[•\-\*]\s*([A-Z][a-zA-Z0-9\s-]+?)(?:[,.;]|$)/gmi;
  const matches = text.matchAll(listPattern);

  for (const match of matches) {
    if (match[1]) {
      const cleaned = cleanSkillText(match[1]);
      if (cleaned && cleaned.length >= 2) {
        // Check if it looks like a skill (contains capitalized words)
        const hasCapitalized = /[A-Z][a-z]+/.test(cleaned);
        if (hasCapitalized) {
          const normalized = normalizeSkillName(cleaned);
          if (normalized && !seen.has(normalized.toLowerCase())) {
            skills.push(normalized);
            seen.add(normalized.toLowerCase());
          }
        }
      }
    }
  }

  return skills;
}

/**
 * Extract skills from comma-separated lists
 */
function extractSkillsFromCommaLists(text: string): string[] {
  const skills: string[] = [];
  const seen = new Set<string>();

  // Pattern: "Skills: X, Y, Z" or "Technologies: X, Y, Z"
  const commaListPattern = /(?:skills?|technologies?|tools?|languages?|frameworks?|platforms?)[:\s]+([A-Z][a-zA-Z0-9\s,\-]+?)(?:[.;]|$)/gi;
  const matches = text.matchAll(commaListPattern);

  for (const match of matches) {
    if (match[1]) {
      const items = match[1].split(',').map(item => item.trim());
      for (const item of items) {
        const cleaned = cleanSkillText(item);
        if (cleaned && cleaned.length >= 2) {
          const normalized = normalizeSkillName(cleaned);
          if (normalized && !seen.has(normalized.toLowerCase())) {
            skills.push(normalized);
            seen.add(normalized.toLowerCase());
          }
        }
      }
    }
  }

  return skills;
}

/**
 * Extract skills from job description text
 * 
 * Uses multiple heuristics to identify skills:
 * 1. Capitalized words (likely technologies)
 * 2. Patterns like "experience with X"
 * 3. Bullet point lists
 * 4. Comma-separated skill lists
 * 
 * @param jobDescription - Raw job description text
 * @returns Extracted skills with primary_skill and secondary_skills
 */
export function extractSkillsFromJobDescription(
  jobDescription: string
): ExtractedSkills {
  if (!jobDescription || typeof jobDescription !== 'string') {
    return {
      primary_skill: null,
      secondary_skills: [],
    };
  }

  // Normalize text
  const normalizedText = jobDescription.trim();

  if (!normalizedText) {
    return {
      primary_skill: null,
      secondary_skills: [],
    };
  }

  // Collect skills from all extraction methods
  const allSkills: string[] = [];
  const seen = new Set<string>();

  // Method 1: Extract from patterns (highest confidence)
  const patternSkills = extractSkillsFromPatterns(normalizedText);
  for (const skill of patternSkills) {
    if (!seen.has(skill.toLowerCase())) {
      allSkills.push(skill);
      seen.add(skill.toLowerCase());
    }
  }

  // Method 2: Extract from comma-separated lists
  const commaListSkills = extractSkillsFromCommaLists(normalizedText);
  for (const skill of commaListSkills) {
    if (!seen.has(skill.toLowerCase())) {
      allSkills.push(skill);
      seen.add(skill.toLowerCase());
    }
  }

  // Method 3: Extract from bullet points
  const listSkills = extractSkillsFromLists(normalizedText);
  for (const skill of listSkills) {
    if (!seen.has(skill.toLowerCase())) {
      allSkills.push(skill);
      seen.add(skill.toLowerCase());
    }
  }

  // Method 4: Extract capitalized words (lowest confidence, fill gaps)
  const capitalizedSkills = extractCapitalizedSkills(normalizedText);
  for (const skill of capitalizedSkills) {
    if (!seen.has(skill.toLowerCase())) {
      allSkills.push(skill);
      seen.add(skill.toLowerCase());
    }
  }

  // Remove duplicates (case-insensitive) while preserving order
  const uniqueSkills: string[] = [];
  const uniqueSet = new Set<string>();
  for (const skill of allSkills) {
    const lower = skill.toLowerCase();
    if (!uniqueSet.has(lower) && skill.length >= 2) {
      uniqueSkills.push(skill);
      uniqueSet.add(lower);
    }
  }

  // First skill is primary, rest are secondary
  const primary_skill = uniqueSkills.length > 0 ? uniqueSkills[0] : null;
  const secondary_skills = uniqueSkills.slice(1);

  return {
    primary_skill,
    secondary_skills,
  };
}
