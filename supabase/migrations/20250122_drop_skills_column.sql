-- ============================================
-- Drop skills column from scraped_jobs
-- ============================================
-- We now use must_have_skills and good_to_have_skills instead
-- This migration removes the redundant skills column

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'skills'
  ) THEN
    -- Drop the GIN index on skills if it exists
    DROP INDEX IF EXISTS idx_scraped_jobs_skills;
    
    -- Drop the column
    ALTER TABLE public.scraped_jobs 
    DROP COLUMN skills;
    
    RAISE NOTICE '✅ Dropped skills column from scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  skills column does not exist in scraped_jobs';
  END IF;
END $$;

