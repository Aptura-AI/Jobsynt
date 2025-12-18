-- ============================================
-- Add Target Candidate IDs to scraped_jobs
-- ============================================
-- Allows recruiters to explicitly target jobs to specific candidates

-- Step 1: Add target_candidate_ids column to scraped_jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'target_candidate_ids'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN target_candidate_ids TEXT DEFAULT NULL;
    
    RAISE NOTICE '✅ Added target_candidate_ids column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  target_candidate_ids column already exists';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Target candidate IDs migration completed successfully!';
END $$;
