/**
 * Platform Extraction from Job Title and Skills
 * 
 * Extracts primary platform from job title and skills at ingestion time.
 * This is deterministic and runs once when job is uploaded.
 * 
 * Platform mapping rules:
 * - PeopleSoft: "PeopleSoft", "PSFT", "PS"
 * - Oracle Fusion: "Oracle Fusion", "Oracle Cloud", "Fusion HCM", "Fusion ERP"
 * - Oracle EBS: "Oracle EBS", "Oracle E-Business Suite", "EBS"
 * - Workday: "Workday", "WD"
 * - SAP: "SAP", "SAP HCM", "SAP SuccessFactors"
 * - etc.
 */

export type PlatformKeywords = {
  platform: string;
  keywords: string[];
};

const PLATFORM_KEYWORDS: PlatformKeywords[] = [
  {
    platform: 'PeopleSoft',
    keywords: ['peoplesoft', 'psft', 'ps ', 'people soft'],
  },
  {
    platform: 'Oracle Fusion',
    keywords: ['oracle fusion', 'fusion hcm', 'fusion erp', 'oracle cloud hcm', 'oracle cloud erp', 'fusion cloud'],
  },
  {
    platform: 'Oracle EBS',
    keywords: ['oracle ebs', 'oracle e-business suite', 'ebs ', 'oracle applications'],
  },
  {
    platform: 'Workday',
    keywords: ['workday', 'wd '],
  },
  {
    platform: 'SAP',
    keywords: ['sap hcm', 'sap successfactors', 'sap erp', 'sap '],
  },
  {
    platform: 'ServiceNow',
    keywords: ['servicenow', 'service now'],
  },
  {
    platform: 'Salesforce',
    keywords: ['salesforce', 'sfdc', 'sales force'],
  },
];

/**
 * Extract primary platform from job title and skills
 * 
 * @param title - Job title
 * @param skills - Array of skills (must_have_skills + good_to_have_skills)
 * @returns Primary platform string or null if not found
 */
export function extractPlatformFromJob(
  title: string | null | undefined,
  skills: string[] | null | undefined
): string | null {
  const searchText = [
    title || '',
    ...(skills || []),
  ]
    .join(' ')
    .toLowerCase()
    .trim();

  if (!searchText) {
    return null;
  }

  // Check each platform's keywords
  for (const { platform, keywords } of PLATFORM_KEYWORDS) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return platform;
      }
    }
  }

  return null;
}

/**
 * Extract secondary platforms (if job involves multiple platforms)
 * Currently returns empty array - can be enhanced later
 */
export function extractSecondaryPlatforms(
  title: string | null | undefined,
  skills: string[] | null | undefined
): string[] {
  // For now, return empty array
  // Can be enhanced to detect multi-platform jobs
  return [];
}

