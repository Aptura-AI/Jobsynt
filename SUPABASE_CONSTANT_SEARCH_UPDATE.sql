-- ===================================================================
-- IMPORTANT: We are NOT creating new tables!
-- This script only ADDS COLUMNS to the existing 'scraped_jobs' table
-- ===================================================================

-- First, add the profile_id column if it doesn't exist
-- This column links jobs to specific user profiles (NULL = available to all)
ALTER TABLE scraped_jobs 
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES auth.users(id);

-- Add columns to the EXISTING scraped_jobs table for constant search functionality
-- This enhances the table we already use for all job storage
ALTER TABLE scraped_jobs 
ADD COLUMN IF NOT EXISTS is_constant_search BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS constant_search_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS search_type VARCHAR(50);

-- Create indexes on the EXISTING table for faster queries
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_constant_search 
ON scraped_jobs(is_constant_search, constant_search_type);

-- Index for global jobs (profile_id = NULL)
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_global 
ON scraped_jobs(profile_id) WHERE profile_id IS NULL;

-- Index for user-specific jobs (profile_id = actual user ID)
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_user_specific 
ON scraped_jobs(profile_id) WHERE profile_id IS NOT NULL;

-- Update any existing PeopleSoft jobs to mark them as constant search
UPDATE scraped_jobs 
SET is_constant_search = TRUE, 
    constant_search_type = 'peoplesoft_it_c2c' 
WHERE title ILIKE '%peoplesoft%' 
AND job_type ILIKE '%contract%' 
AND profile_id IS NULL;

-- ===================================================================
-- VIEWS (Optional - these are just for convenience, not new tables)
-- Views are virtual tables that just filter the existing scraped_jobs
-- ===================================================================

-- View to easily see constant search jobs (just a filter on scraped_jobs)
CREATE OR REPLACE VIEW constant_search_jobs AS
SELECT *
FROM scraped_jobs 
WHERE is_constant_search = TRUE 
AND profile_id IS NULL
ORDER BY scraped_at DESC;

-- View for PeopleSoft jobs specifically (just another filter)
CREATE OR REPLACE VIEW peoplesoft_it_c2c_jobs AS
SELECT *
FROM scraped_jobs 
WHERE is_constant_search = TRUE 
AND constant_search_type = 'peoplesoft_it_c2c'
AND profile_id IS NULL
ORDER BY scraped_at DESC;

-- Grant access to views
GRANT SELECT ON constant_search_jobs TO anon, authenticated;
GRANT SELECT ON peoplesoft_it_c2c_jobs TO anon, authenticated;

-- ===================================================================
-- SUMMARY: 
-- - Same scraped_jobs table (no new tables)
-- - Added profile_id column for user-specific jobs
-- - 3 new columns added for constant search organization
-- - Indexes for fast searching
-- - Views for convenience (optional)
-- =================================================================== 