/**
 * Apply for Me Configuration
 * 
 * Feature flags and configuration for collaborative automation.
 */

// Feature flag: Full automation mode (disabled by default)
export const AUTO_APPLY_ENABLED = process.env.AUTO_APPLY_ENABLED === 'true';

// Default mode
export const DEFAULT_APPLY_MODE: 'COLLABORATIVE' | 'FULLY_AUTOMATED' = AUTO_APPLY_ENABLED 
  ? 'FULLY_AUTOMATED' 
  : 'COLLABORATIVE';

// Maximum jobs per batch
export const MAX_JOBS_PER_BATCH = 10;

// Browser timeout (ms)
export const BROWSER_TIMEOUT = 30000;

// Resume check interval (ms) - how often to check for resumed applications
export const RESUME_CHECK_INTERVAL = 5000;

// Maximum pause duration (ms) - after this, application is considered abandoned
export const MAX_PAUSE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

