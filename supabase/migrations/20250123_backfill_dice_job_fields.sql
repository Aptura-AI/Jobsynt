-- ============================================
-- Backfill Missing Fields for Dice Scraped Jobs
-- ============================================
-- This migration backfills missing fields for jobs scraped from Dice
-- before the scraper was updated to extract all schema fields
-- 
-- Fields being backfilled:
-- - primary_platform (from title + must_have_skills)
-- - secondary_platforms (from title + must_have_skills)
-- - required_years_experience (from description)
-- - salary / pay_rate_raw (from description)
-- - location_raw (copy from location)
-- - description_raw (copy from description)

-- ============================================
-- PART 1: Set location_raw and description_raw
-- ============================================
UPDATE scraped_jobs
SET 
  location_raw = location,
  description_raw = description
WHERE 
  source = 'Dice'
  AND (location_raw IS NULL OR description_raw IS NULL);

-- ============================================
-- PART 2: Extract and set primary_platform
-- ============================================
-- Extract platform from title and skills
UPDATE scraped_jobs
SET primary_platform = 
  CASE
    -- PeopleSoft
    WHEN LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%peoplesoft%' 
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%psft%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%ps %' THEN 'PeopleSoft'
    
    -- Oracle Fusion
    WHEN LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%oracle fusion%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%fusion hcm%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%fusion erp%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%oracle cloud hcm%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%oracle cloud erp%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%fusion cloud%' THEN 'Oracle Fusion'
    
    -- Oracle EBS
    WHEN LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%oracle ebs%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%oracle e-business suite%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%ebs %'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%oracle applications%' THEN 'Oracle EBS'
    
    -- Workday
    WHEN LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%workday%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%wd %' THEN 'Workday'
    
    -- SAP
    WHEN LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%sap hcm%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%sap successfactors%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%sap erp%'
      OR (LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%sap %'
          AND LOWER(title || ' ' || COALESCE(must_have_skills, '')) NOT LIKE '%sapien%') THEN 'SAP'
    
    -- ServiceNow
    WHEN LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%servicenow%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%service now%' THEN 'ServiceNow'
    
    -- Salesforce
    WHEN LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%salesforce%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%sfdc%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%sales force%' THEN 'Salesforce'
    
    ELSE ''
  END
WHERE 
  source = 'Dice'
  AND (primary_platform IS NULL OR primary_platform = '');

-- ============================================
-- PART 3: Extract and set required_years_experience
-- ============================================
-- Extract experience from description (patterns like "5+ years", "10 years experience")
UPDATE scraped_jobs
SET required_years_experience = 
  CASE
    WHEN description ~* '(\d+)\+?\s*(?:years?|yrs?|year[''\s]+of|year[''\s]+experience)' THEN
      CAST((regexp_match(description, '(\d+)\+?\s*(?:years?|yrs?|year[''\s]+of|year[''\s]+experience)', 'i'))[1] AS INTEGER)
    ELSE 0
  END
WHERE 
  source = 'Dice'
  AND (required_years_experience IS NULL OR required_years_experience = 0)
  AND description IS NOT NULL;

-- ============================================
-- PART 4: Extract and set salary / pay_rate_raw
-- ============================================
-- Extract salary from description (patterns like "$80/hr", "$100k", "$80-100/hr")
UPDATE scraped_jobs
SET 
  salary = 
    CASE
      WHEN description ~* '\$(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour|annually|yearly|per year)' THEN
        (regexp_match(description, '\$(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour|annually|yearly|per year)', 'i'))[0]
      WHEN description ~* '\$(\d+(?:,\d{3})*(?:k|K)?)\s*-\s*\$(\d+(?:,\d{3})*(?:k|K)?)' THEN
        (regexp_match(description, '\$(\d+(?:,\d{3})*(?:k|K)?)\s*-\s*\$(\d+(?:,\d{3})*(?:k|K)?)', 'i'))[0]
      ELSE NULL
    END,
  pay_rate_raw = 
    CASE
      WHEN description ~* '\$(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour|annually|yearly|per year)' THEN
        (regexp_match(description, '\$(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour|annually|yearly|per year)', 'i'))[0]
      WHEN description ~* '\$(\d+(?:,\d{3})*(?:k|K)?)\s*-\s*\$(\d+(?:,\d{3})*(?:k|K)?)' THEN
        (regexp_match(description, '\$(\d+(?:,\d{3})*(?:k|K)?)\s*-\s*\$(\d+(?:,\d{3})*(?:k|K)?)', 'i'))[0]
      ELSE NULL
    END
WHERE 
  source = 'Dice'
  AND (salary IS NULL OR pay_rate_raw IS NULL)
  AND description IS NOT NULL;

-- ============================================
-- PART 5: Summary Report
-- ============================================
DO $$
DECLARE
  total_dice_jobs INTEGER;
  with_platform INTEGER;
  with_experience INTEGER;
  with_salary INTEGER;
  with_raw_fields INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_dice_jobs FROM scraped_jobs WHERE source = 'Dice';
  SELECT COUNT(*) INTO with_platform FROM scraped_jobs WHERE source = 'Dice' AND primary_platform IS NOT NULL AND primary_platform != '';
  SELECT COUNT(*) INTO with_experience FROM scraped_jobs WHERE source = 'Dice' AND required_years_experience > 0;
  SELECT COUNT(*) INTO with_salary FROM scraped_jobs WHERE source = 'Dice' AND salary IS NOT NULL;
  SELECT COUNT(*) INTO with_raw_fields FROM scraped_jobs WHERE source = 'Dice' AND location_raw IS NOT NULL AND description_raw IS NOT NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Dice Jobs Backfill Summary';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Dice jobs: %', total_dice_jobs;
  RAISE NOTICE 'Jobs with platform: %', with_platform;
  RAISE NOTICE 'Jobs with experience: %', with_experience;
  RAISE NOTICE 'Jobs with salary: %', with_salary;
  RAISE NOTICE 'Jobs with raw fields: %', with_raw_fields;
  RAISE NOTICE '========================================';
END $$;

