-- ============================================
-- Fix Platform Misidentification for Dice Jobs
-- ============================================
-- This fixes jobs where "Oracle Cloud HCM" was incorrectly identified as "PeopleSoft"
-- Run this AFTER the improved backfill migration

-- Fix: Oracle Cloud HCM jobs that were misidentified as PeopleSoft
UPDATE scraped_jobs
SET primary_platform = 'Oracle Fusion'
WHERE 
  source = 'Dice'
  AND primary_platform = 'PeopleSoft'
  AND (
    LOWER(title) LIKE '%oracle cloud hcm%'
    OR LOWER(title) LIKE '%oracle hcm cloud%'
    OR LOWER(title) LIKE '%oracle fusion%'
    OR LOWER(title) LIKE '%fusion hcm%'
    OR LOWER(COALESCE(must_have_skills, '')) LIKE '%oracle cloud hcm%'
    OR LOWER(COALESCE(must_have_skills, '')) LIKE '%oracle fusion%'
  );

-- Fix: Oracle HCM Cloud jobs that might be missing platform
UPDATE scraped_jobs
SET primary_platform = 'Oracle Fusion'
WHERE 
  source = 'Dice'
  AND (primary_platform IS NULL OR primary_platform = '')
  AND (
    LOWER(title) LIKE '%oracle cloud hcm%'
    OR LOWER(title) LIKE '%oracle hcm cloud%'
    OR LOWER(title) LIKE '%oracle fusion%'
    OR LOWER(title) LIKE '%fusion hcm%'
    OR LOWER(COALESCE(must_have_skills, '')) LIKE '%oracle cloud hcm%'
    OR LOWER(COALESCE(must_have_skills, '')) LIKE '%oracle fusion%'
  );

-- Summary
DO $$
DECLARE
  fixed_count INTEGER;
  total_dice INTEGER;
BEGIN
  SELECT COUNT(*) INTO fixed_count
  FROM scraped_jobs
  WHERE source = 'Dice' AND primary_platform = 'Oracle Fusion';
  
  SELECT COUNT(*) INTO total_dice
  FROM scraped_jobs
  WHERE source = 'Dice';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Platform Fix Summary';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Dice jobs: %', total_dice;
  RAISE NOTICE 'Jobs with Oracle Fusion platform: %', fixed_count;
  RAISE NOTICE '========================================';
END $$;

