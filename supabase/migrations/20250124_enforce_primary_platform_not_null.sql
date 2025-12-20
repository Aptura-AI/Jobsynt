-- ============================================
-- Migration: Enforce primary_platform NOT NULL
-- Date: 2025-01-24
-- Purpose: PART B - Ensure primary_platform is never NULL
-- ============================================

-- First, backfill any NULL primary_platform values with a default
-- This prevents constraint violation
UPDATE scraped_jobs
SET primary_platform = 'Unknown Platform'
WHERE primary_platform IS NULL;

-- Add NOT NULL constraint
ALTER TABLE scraped_jobs
ALTER COLUMN primary_platform SET NOT NULL;

-- Add CHECK constraint to prevent NULL
ALTER TABLE scraped_jobs
ADD CONSTRAINT scraped_jobs_primary_platform_not_null 
CHECK (primary_platform IS NOT NULL AND primary_platform != '');

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed:';
  RAISE NOTICE '   - NULL primary_platform values backfilled';
  RAISE NOTICE '   - NOT NULL constraint added';
  RAISE NOTICE '   - CHECK constraint added';
END $$;

