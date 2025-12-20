-- ============================================
-- Migration: Add job_type (work location) column
-- Date: 2025-01-24
-- Purpose: 
--   Replace is_remote with job_type enum for work location
--   job_type = 'Remote' | 'Hybrid' | 'Onsite'
--   This is separate from employment job_type (full-time, w2-contract, etc.)
-- ============================================

-- Create enum type for work location if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_location_type_enum') THEN
    CREATE TYPE work_location_type_enum AS ENUM ('Remote', 'Hybrid', 'Onsite');
    RAISE NOTICE '✅ Created work_location_type_enum type';
  ELSE
    RAISE NOTICE 'ℹ️  work_location_type_enum type already exists';
  END IF;
END $$;

-- Add job_type column (work location) if it doesn't exist
-- Note: We're using 'work_location_type' as column name to avoid conflict with existing 'job_type' (employment type)
ALTER TABLE scraped_jobs 
ADD COLUMN IF NOT EXISTS work_location_type work_location_type_enum;

-- Backfill work_location_type from existing location_type or is_remote
UPDATE scraped_jobs
SET work_location_type = 
  CASE 
    WHEN location_type = 'Remote'::location_type_enum OR is_remote = true THEN 'Remote'::work_location_type_enum
    WHEN location_type = 'Hybrid'::location_type_enum THEN 'Hybrid'::work_location_type_enum
    WHEN location_type = 'Onsite'::location_type_enum THEN 'Onsite'::work_location_type_enum
    WHEN location ILIKE '%remote%' THEN 'Remote'::work_location_type_enum
    WHEN location ILIKE '%hybrid%' THEN 'Hybrid'::work_location_type_enum
    ELSE 'Onsite'::work_location_type_enum
  END
WHERE work_location_type IS NULL;

-- Set default to Remote for NULL values
ALTER TABLE scraped_jobs 
ALTER COLUMN work_location_type SET DEFAULT 'Remote'::work_location_type_enum;

-- Update NULL values to Remote (default)
UPDATE scraped_jobs 
SET work_location_type = 'Remote'::work_location_type_enum 
WHERE work_location_type IS NULL;

-- Add NOT NULL constraint after backfilling
ALTER TABLE scraped_jobs 
ALTER COLUMN work_location_type SET NOT NULL;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed:';
  RAISE NOTICE '   - work_location_type_enum created';
  RAISE NOTICE '   - work_location_type column added';
  RAISE NOTICE '   - Values backfilled from location_type/is_remote';
  RAISE NOTICE '   - Default set to Remote';
END $$;

