-- ============================================
-- Fix Remaining Platform Issues for Dice Jobs
-- ============================================
-- This fixes:
-- 1. AI/ML jobs incorrectly identified as PeopleSoft
-- 2. Oracle Technical HCM jobs missing platform

-- Fix 1: Remove PeopleSoft from AI/ML jobs (they're not ERP platforms)
UPDATE scraped_jobs
SET primary_platform = NULL
WHERE 
  source = 'Dice'
  AND primary_platform = 'PeopleSoft'
  AND (
    LOWER(title) LIKE '%ai%'
    OR LOWER(title) LIKE '%ml%'
    OR LOWER(title) LIKE '%machine learning%'
    OR LOWER(title) LIKE '%artificial intelligence%'
    OR LOWER(title) LIKE '%data scientist%'
    OR LOWER(title) LIKE '%ai/ml%'
    OR LOWER(title) LIKE '%ai architect%'
    OR LOWER(title) LIKE '%ml engineer%'
  )
  AND LOWER(title) NOT LIKE '%peoplesoft%'
  AND LOWER(COALESCE(must_have_skills, '')) NOT LIKE '%peoplesoft%';

-- Fix 2: Set Oracle Fusion for Oracle Technical HCM jobs
UPDATE scraped_jobs
SET primary_platform = 'Oracle Fusion'
WHERE 
  source = 'Dice'
  AND (primary_platform IS NULL OR primary_platform = '')
  AND (
    LOWER(title) LIKE '%oracle%hcm%'
    OR LOWER(title) LIKE '%oracle%technical%hcm%'
    OR LOWER(title) LIKE '%oracle hcm%'
    OR LOWER(COALESCE(must_have_skills, '')) LIKE '%oracle%hcm%'
  )
  AND LOWER(title) NOT LIKE '%peoplesoft%'
  AND LOWER(title) NOT LIKE '%ai%'
  AND LOWER(title) NOT LIKE '%ml%';

-- Summary
DO $$
DECLARE
  ai_ml_fixed INTEGER;
  oracle_fixed INTEGER;
  total_dice INTEGER;
  with_platform INTEGER;
BEGIN
  SELECT COUNT(*) INTO ai_ml_fixed
  FROM scraped_jobs
  WHERE source = 'Dice' 
    AND primary_platform IS NULL
    AND (LOWER(title) LIKE '%ai%' OR LOWER(title) LIKE '%ml%');
  
  SELECT COUNT(*) INTO oracle_fixed
  FROM scraped_jobs
  WHERE source = 'Dice' AND primary_platform = 'Oracle Fusion';
  
  SELECT COUNT(*) INTO total_dice
  FROM scraped_jobs
  WHERE source = 'Dice';
  
  SELECT COUNT(*) INTO with_platform
  FROM scraped_jobs
  WHERE source = 'Dice' 
    AND primary_platform IS NOT NULL 
    AND primary_platform != '';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Platform Fix Summary';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Dice jobs: %', total_dice;
  RAISE NOTICE 'Jobs with platform: %', with_platform;
  RAISE NOTICE 'Oracle Fusion jobs: %', oracle_fixed;
  RAISE NOTICE 'AI/ML jobs (no platform): %', ai_ml_fixed;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Note: AI/ML jobs correctly have NULL platform';
  RAISE NOTICE '      (they are not ERP/HRMS platforms)';
  RAISE NOTICE '========================================';
END $$;

