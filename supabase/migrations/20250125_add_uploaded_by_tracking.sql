-- ============================================
-- Migration: Add uploaded_by job source tracking
-- Date: 2025-01-25
-- Purpose: Track job origin (recruiter vs scraper)
-- ============================================

-- Add uploaded_by column to scraped_jobs table
ALTER TABLE scraped_jobs 
ADD COLUMN IF NOT EXISTS uploaded_by TEXT DEFAULT 'scraper'
CHECK (uploaded_by IN ('recruiter', 'scraper'));

-- Set default for existing rows
UPDATE scraped_jobs 
SET uploaded_by = 'scraper' 
WHERE uploaded_by IS NULL;

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_uploaded_by 
ON scraped_jobs(uploaded_by);

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed:';
  RAISE NOTICE '   - uploaded_by column added to scraped_jobs';
  RAISE NOTICE '   - Default set to scraper';
  RAISE NOTICE '   - Check constraint added (recruiter, scraper)';
  RAISE NOTICE '   - Index created';
END $$;

