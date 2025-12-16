/**
 * Job Type Constants
 * 
 * Centralized definition of valid job types across the platform.
 * DO NOT hardcode job types elsewhere - use these constants.
 */

export const ALLOWED_JOB_TYPES = ['full-time', 'w2-contract', 'c2c', '1099'] as const;

export type JobType = typeof ALLOWED_JOB_TYPES[number];

/**
 * Job type labels for display
 */
export const JOB_TYPE_LABELS: Record<JobType, string> = {
  'full-time': 'Full-time',
  'w2-contract': 'W2 Contract',
  'c2c': 'C2C',
  '1099': '1099',
};

/**
 * Default job type when inference fails
 */
export const DEFAULT_JOB_TYPE: JobType = 'w2-contract';

/**
 * Validates if a job type is allowed
 */
export function isValidJobType(value: string): value is JobType {
  return ALLOWED_JOB_TYPES.includes(value as JobType);
}

/**
 * Infers job type from description text
 */
export function inferJobTypeFromDescription(description: string): JobType {
  const text = description.toLowerCase();
  
  // Check for C2C / Corp to Corp
  if (text.includes('c2c') || text.includes('corp to corp') || text.includes('corp-to-corp')) {
    return 'c2c';
  }
  
  // Check for 1099
  if (text.includes('1099')) {
    return '1099';
  }
  
  // Check for W2
  if (text.includes('w2') || text.includes('w-2')) {
    return 'w2-contract';
  }
  
  // Check for Full-time / Permanent
  if (text.includes('full-time') || text.includes('fulltime') || text.includes('permanent')) {
    return 'full-time';
  }
  
  // Default to w2-contract if cannot be determined
  return DEFAULT_JOB_TYPE;
}

