/**
 * Resume Parser - Converts extracted PDF text to structured JSON
 * 
 * This module normalizes resume text into a structured format for GPT consumption.
 * GPT never sees raw PDF - only this parsed JSON + job description.
 */

export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  work_authorization: string;
  salary_expectation: string;
}

export interface WorkExperience {
  title: string;
  company: string;
  duration: string;
  description: string;
}

export interface Education {
  degree: string;
  institution: string;
  year: string;
}

/**
 * Parse resume text into structured JSON
 * 
 * Uses pattern matching and heuristics to extract:
 * - Contact info (email, phone)
 * - Skills (from skills section or throughout)
 * - Work experience (job titles, companies, dates)
 * - Education (degrees, institutions)
 * - Location
 * 
 * Guardrails:
 * - Never throws - returns empty strings/arrays on failure
 * - Logs parsing errors, doesn't block upload
 */
export function parseResumeToJSON(resumeText: string, profileData?: {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  skills?: string[];
  visa_status?: string;
  rate_expectation?: number;
}): ParsedResume {
  const text = resumeText.toLowerCase();
  
  // Extract email (use profile email if available, otherwise parse from text)
  const email = profileData?.email || extractEmail(resumeText) || '';
  
  // Extract phone (use profile phone if available, otherwise parse from text)
  const phone = profileData?.phone || extractPhone(resumeText) || '';
  
  // Extract name (use profile name if available, otherwise parse from text)
  const name = profileData?.name || extractName(resumeText) || '';
  
  // Extract location (use profile location if available, otherwise parse from text)
  const location = profileData?.location || extractLocation(resumeText) || '';
  
  // Extract skills (use profile skills if available, otherwise parse from text)
  const skills = profileData?.skills || extractSkills(resumeText) || [];
  
  // Extract work experience
  const experience = extractWorkExperience(resumeText);
  
  // Extract education
  const education = extractEducation(resumeText);
  
  // Extract work authorization (from visa status or keywords)
  const work_authorization = extractWorkAuthorization(resumeText, profileData);
  
  // Extract salary expectation (from profile or resume)
  const salary_expectation = extractSalaryExpectation(resumeText, profileData);
  
  return {
    name,
    email,
    phone,
    location,
    skills,
    experience,
    education,
    work_authorization,
    salary_expectation,
  };
}

/**
 * Extract email from resume text
 */
function extractEmail(text: string): string {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const matches = text.match(emailRegex);
  return matches?.[0] || '';
}

/**
 * Extract phone number from resume text
 */
function extractPhone(text: string): string {
  // Match various phone formats: (123) 456-7890, 123-456-7890, 123.456.7890, etc.
  const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
  const matches = text.match(phoneRegex);
  return matches?.[0] || '';
}

/**
 * Extract name (usually first line or after "Name:" label)
 */
function extractName(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Look for "Name:" label
  for (const line of lines) {
    if (line.toLowerCase().startsWith('name:')) {
      return line.substring(5).trim();
    }
  }
  
  // Use first line if it looks like a name (2-4 words, capitalized)
  if (lines.length > 0) {
    const firstLine = lines[0];
    const words = firstLine.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && 
        words.every(w => w[0] === w[0].toUpperCase() && /^[A-Za-z]+$/.test(w))) {
      return firstLine;
    }
  }
  
  return '';
}

/**
 * Extract location (city, state or city, country)
 */
function extractLocation(text: string): string {
  // Look for "Location:" label
  const locationMatch = text.match(/location:?\s*([^\n]+)/i);
  if (locationMatch) {
    return locationMatch[1].trim();
  }
  
  // Look for common location patterns: "City, State" or "City, Country"
  const locationPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2}|[A-Z][a-z]+)/g;
  const matches = Array.from(text.matchAll(locationPattern));
  if (matches.length > 0) {
    return matches[0][0];
  }
  
  return '';
}

/**
 * Extract skills (from skills section or throughout document)
 */
function extractSkills(text: string): string[] {
  const skills: string[] = [];
  
  // Look for "Skills:" section
  const skillsSectionMatch = text.match(/skills?:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n[A-Z]|$)/i);
  if (skillsSectionMatch) {
    const skillsText = skillsSectionMatch[1];
    // Split by commas, semicolons, or newlines
    const skillList = skillsText.split(/[,;\n]/).map(s => s.trim()).filter(s => s.length > 0);
    skills.push(...skillList);
  }
  
  // Also look for technical keywords throughout (common tech stack terms)
  const techKeywords = [
    'javascript', 'python', 'java', 'react', 'node.js', 'sql', 'aws', 'azure',
    'peoplesoft', 'oracle', 'sap', 'workday', 'salesforce', 'microsoft',
    'html', 'css', 'typescript', 'angular', 'vue', 'docker', 'kubernetes'
  ];
  
  for (const keyword of techKeywords) {
    if (text.toLowerCase().includes(keyword) && !skills.includes(keyword)) {
      skills.push(keyword);
    }
  }
  
  return skills.slice(0, 20); // Limit to 20 skills
}

/**
 * Extract work experience
 */
function extractWorkExperience(text: string): WorkExperience[] {
  const experience: WorkExperience[] = [];
  
  // Look for experience section
  const experienceSectionMatch = text.match(/(?:experience|work history|employment):?\s*([\s\S]*?)(?=\n\n(?:education|skills|projects)|$)/i);
  if (!experienceSectionMatch) {
    return experience;
  }
  
  const experienceText = experienceSectionMatch[1];
  
  // Split by common separators (double newline, dates, etc.)
  const jobBlocks = experienceText.split(/\n\n|\n(?=\d{4}|\w+\s+\d{4})/);
  
  for (const block of jobBlocks) {
    if (block.trim().length < 20) continue; // Skip very short blocks
    
    // Extract job title (usually first line)
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const title = lines[0] || '';
    
    // Extract company (usually second line or after title)
    let company = '';
    for (let i = 1; i < Math.min(3, lines.length); i++) {
      if (lines[i] && !lines[i].match(/\d{4}/)) { // Not a date
        company = lines[i];
        break;
      }
    }
    
    // Extract duration (look for date patterns)
    const dateMatch = block.match(/(\w+\s+\d{4}|\d{4})\s*[-–—]\s*(\w+\s+\d{4}|\d{4}|present|current)/i);
    const duration = dateMatch ? dateMatch[0] : '';
    
    // Extract description (rest of the block)
    const description = block.substring(
      title.length + company.length + duration.length
    ).trim();
    
    if (title) {
      experience.push({
        title,
        company,
        duration,
        description,
      });
    }
  }
  
  return experience.slice(0, 10); // Limit to 10 most recent
}

/**
 * Extract education
 */
function extractEducation(text: string): Education[] {
  const education: Education[] = [];
  
  // Look for education section
  const educationSectionMatch = text.match(/(?:education|academic):?\s*([\s\S]*?)(?=\n\n(?:experience|skills|projects)|$)/i);
  if (!educationSectionMatch) {
    return education;
  }
  
  const educationText = educationSectionMatch[1];
  const lines = educationText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  for (const line of lines) {
    // Look for degree patterns: "Bachelor of Science", "BS", "MBA", etc.
    const degreeMatch = line.match(/(bachelor|master|phd|mba|bs|ba|ms|ma|doctorate)[\s\S]*?(?:in|,)?\s*([^\n,]+)/i);
    if (degreeMatch) {
      const degree = degreeMatch[0];
      
      // Look for institution (usually on same or next line)
      const institutionMatch = line.match(/(?:from|at|,)\s*([A-Z][^\n,]+)/i) || 
                             lines[lines.indexOf(line) + 1]?.match(/([A-Z][^\n,]+)/);
      const institution = institutionMatch ? institutionMatch[1] : '';
      
      // Look for year
      const yearMatch = line.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? yearMatch[0] : '';
      
      education.push({
        degree,
        institution,
        year,
      });
    }
  }
  
  return education.slice(0, 5); // Limit to 5 entries
}

/**
 * Extract work authorization status
 */
function extractWorkAuthorization(text: string, profileData?: any): string {
  // Check profile data first
  if (profileData?.visa_status) {
    return profileData.visa_status;
  }
  
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('us citizen') || lowerText.includes('citizen')) {
    return 'US Citizen';
  }
  if (lowerText.includes('green card') || lowerText.includes('permanent resident')) {
    return 'Green Card';
  }
  if (lowerText.includes('h1b') || lowerText.includes('h-1b')) {
    return 'H1B';
  }
  if (lowerText.includes('opt') || lowerText.includes('f1')) {
    return 'OPT/F1';
  }
  
  return '';
}

/**
 * Extract salary expectation
 */
function extractSalaryExpectation(text: string, profileData?: any): string {
  // Check profile data first
  if (profileData?.rate_expectation) {
    return profileData.rate_expectation;
  }
  
  // Look for salary/rate mentions in resume
  const salaryMatch = text.match(/(?:salary|rate|compensation|expect):\s*\$?([\d,]+(?:\s*[-–]\s*\$?[\d,]+)?)\s*(?:per\s+(?:hour|hr|year|annum|month))?/i);
  if (salaryMatch) {
    return salaryMatch[0];
  }
  
  return '';
}

