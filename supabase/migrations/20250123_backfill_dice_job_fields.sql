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
-- IMPORTANT: Order matters - check Oracle Fusion BEFORE PeopleSoft to avoid false matches
UPDATE scraped_jobs
SET primary_platform = 
  CASE
    -- Oracle Fusion (check FIRST - more specific)
    WHEN LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%oracle fusion%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%fusion hcm%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%fusion erp%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%oracle cloud hcm%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%oracle cloud erp%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%fusion cloud%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%oracle hcm cloud%' THEN 'Oracle Fusion'
    
    -- PeopleSoft (check AFTER Oracle to avoid false matches)
    WHEN LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%peoplesoft%' 
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%psft%'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%ps %'
      OR LOWER(title || ' ' || COALESCE(must_have_skills, '')) LIKE '%people soft%' THEN 'PeopleSoft'
    
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
-- Extract experience from description (multiple patterns)
UPDATE scraped_jobs
SET required_years_experience = 
  CASE
    -- Pattern 1: "5+ years", "10 years experience", "5 yrs"
    WHEN description ~* '(\d+)\+?\s*(?:years?|yrs?|year[''\s]+of|year[''\s]+experience)' THEN
      CAST((regexp_match(description, '(\d+)\+?\s*(?:years?|yrs?|year[''\s]+of|year[''\s]+experience)', 'i'))[1] AS INTEGER)
    -- Pattern 2: "5-7 years", "10-12 years" (take the first number)
    WHEN description ~* '(\d+)\s*-\s*\d+\s*(?:years?|yrs?)' THEN
      CAST((regexp_match(description, '(\d+)\s*-\s*\d+\s*(?:years?|yrs?)', 'i'))[1] AS INTEGER)
    -- Pattern 3: "minimum 5 years", "at least 10 years"
    WHEN description ~* '(?:minimum|at least|min\.?)\s*(\d+)\s*(?:years?|yrs?)' THEN
      CAST((regexp_match(description, '(?:minimum|at least|min\.?)\s*(\d+)\s*(?:years?|yrs?)', 'i'))[1] AS INTEGER)
    -- Pattern 4: "5+ YOE", "10 YOE" (years of experience)
    WHEN description ~* '(\d+)\+?\s*YOE' THEN
      CAST((regexp_match(description, '(\d+)\+?\s*YOE', 'i'))[1] AS INTEGER)
    ELSE 0
  END
WHERE 
  source = 'Dice'
  AND (required_years_experience IS NULL OR required_years_experience = 0)
  AND description IS NOT NULL;

-- ============================================
-- PART 4: Extract and set salary / pay_rate_raw
-- ============================================
-- Extract salary from description (multiple patterns)
UPDATE scraped_jobs
SET 
  salary = 
    CASE
      -- Pattern 1: "$80/hr", "$100/hour", "$80 per hour"
      WHEN description ~* '\$(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour|hr\.?)' THEN
        (regexp_match(description, '\$(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour|hr\.?)', 'i'))[0]
      -- Pattern 2: "$80-100/hr", "$80-$100/hr"
      WHEN description ~* '\$(\d+(?:,\d{3})*(?:k|K)?)\s*-\s*\$?(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour)' THEN
        (regexp_match(description, '\$(\d+(?:,\d{3})*(?:k|K)?)\s*-\s*\$?(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour)', 'i'))[0]
      -- Pattern 3: "$100k", "$150k/year", "$100k annually"
      WHEN description ~* '\$(\d+(?:,\d{3})*(?:k|K))\s*(?:\/year|annually|yearly|per year|yr\.?)?' THEN
        (regexp_match(description, '\$(\d+(?:,\d{3})*(?:k|K))\s*(?:\/year|annually|yearly|per year|yr\.?)?', 'i'))[0]
      -- Pattern 4: "$100,000", "$150,000/year"
      WHEN description ~* '\$(\d{1,3}(?:,\d{3})+)\s*(?:\/year|annually|yearly|per year)?' THEN
        (regexp_match(description, '\$(\d{1,3}(?:,\d{3})+)\s*(?:\/year|annually|yearly|per year)?', 'i'))[0]
      -- Pattern 5: "80/hr", "100/hour" (without $ sign)
      WHEN description ~* '(?:^|\s)(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour|hr\.?)(?:\s|$)' THEN
        '$' || (regexp_match(description, '(?:^|\s)(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour|hr\.?)(?:\s|$)', 'i'))[1] || '/hr'
      ELSE NULL
    END,
  pay_rate_raw = 
    CASE
      -- Same patterns as salary
      WHEN description ~* '\$(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour|hr\.?)' THEN
        (regexp_match(description, '\$(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour|hr\.?)', 'i'))[0]
      WHEN description ~* '\$(\d+(?:,\d{3})*(?:k|K)?)\s*-\s*\$?(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour)' THEN
        (regexp_match(description, '\$(\d+(?:,\d{3})*(?:k|K)?)\s*-\s*\$?(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour)', 'i'))[0]
      WHEN description ~* '\$(\d+(?:,\d{3})*(?:k|K))\s*(?:\/year|annually|yearly|per year|yr\.?)?' THEN
        (regexp_match(description, '\$(\d+(?:,\d{3})*(?:k|K))\s*(?:\/year|annually|yearly|per year|yr\.?)?', 'i'))[0]
      WHEN description ~* '\$(\d{1,3}(?:,\d{3})+)\s*(?:\/year|annually|yearly|per year)?' THEN
        (regexp_match(description, '\$(\d{1,3}(?:,\d{3})+)\s*(?:\/year|annually|yearly|per year)?', 'i'))[0]
      WHEN description ~* '(?:^|\s)(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour|hr\.?)(?:\s|$)' THEN
        '$' || (regexp_match(description, '(?:^|\s)(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour|hr\.?)(?:\s|$)', 'i'))[1] || '/hr'
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

