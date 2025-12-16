/**
 * Utility functions for filtering jobs
 */

/**
 * Get the date 30 days ago in YYYY-MM-DD format
 * Used to filter out jobs older than 30 days
 */
export function get30DaysAgoDate(): string {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format
}

/**
 * Check if a job is older than 30 days
 */
export function isJobOlderThan30Days(postedDate: string | null | undefined): boolean {
  if (!postedDate) return false;
  
  const jobDate = new Date(postedDate);
  if (isNaN(jobDate.getTime())) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  jobDate.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - jobDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 30;
}

