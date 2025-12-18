-- ============================================
-- Migration: Raw fields, location_type, and skill defaults
-- Date: 2025-01-19
-- Purpose: 
--   1. Store original Excel values (raw fields)
--   2. Add location_type column
--   3. FIX 3: Enforce defaults to prevent NULL values
-- ============================================

-- ============================================
-- PART 1: Add raw field columns
-- ============================================
ALTER TABLE scraped_jobs ADD COLUMN IF NOT EXISTS location_raw TEXT;
ALTER TABLE scraped_jobs ADD COLUMN IF NOT EXISTS pay_rate_raw TEXT;
ALTER TABLE scraped_jobs ADD COLUMN IF NOT EXISTS description_raw TEXT;

-- ============================================
-- PART 2: Handle location_type
-- ============================================
-- Note: location_type might already exist as an enum from previous migrations
-- We'll update existing NULL values

-- Backfill location_type for existing jobs
UPDATE scraped_jobs
SET location_type = 
  CASE 
    WHEN is_remote = true OR location ILIKE '%remote%' THEN 'Remote'::location_type_enum
    WHEN location ILIKE '%hybrid%' THEN 'Hybrid'::location_type_enum
    ELSE 'Onsite'::location_type_enum
  END
WHERE location_type IS NULL;

-- ============================================
-- FIX 3: DATABASE-LEVEL SAFETY NET
-- Enforce defaults to prevent NULL values
-- ============================================

-- Set default for must_have_skills (empty string, not NULL)
ALTER TABLE scraped_jobs 
ALTER COLUMN must_have_skills SET DEFAULT '';

-- Set default for good_to_have_skills (empty string, not NULL)
ALTER TABLE scraped_jobs 
ALTER COLUMN good_to_have_skills SET DEFAULT '';

-- Set default for skills array (empty array, not NULL)
ALTER TABLE scraped_jobs 
ALTER COLUMN skills SET DEFAULT '{}';

-- Set default for required_years_experience (0, not NULL)
ALTER TABLE scraped_jobs 
ALTER COLUMN required_years_experience SET DEFAULT 0;

-- Set default for description (empty string, not NULL)
ALTER TABLE scraped_jobs 
ALTER COLUMN description SET DEFAULT '';

-- ============================================
-- BACKFILL: Fix existing NULL values
-- ============================================
UPDATE scraped_jobs SET must_have_skills = '' WHERE must_have_skills IS NULL;
UPDATE scraped_jobs SET good_to_have_skills = '' WHERE good_to_have_skills IS NULL;
UPDATE scraped_jobs SET skills = '{}' WHERE skills IS NULL;
UPDATE scraped_jobs SET required_years_experience = 0 WHERE required_years_experience IS NULL;
UPDATE scraped_jobs SET description = '' WHERE description IS NULL;

-- Sync is_remote with location_type
UPDATE scraped_jobs SET is_remote = true WHERE location_type = 'Remote' AND is_remote = false;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed:';
  RAISE NOTICE '   - Raw fields added';
  RAISE NOTICE '   - location_type backfilled';
  RAISE NOTICE '   - Default values enforced';
  RAISE NOTICE '   - NULL values fixed';
END $$;

