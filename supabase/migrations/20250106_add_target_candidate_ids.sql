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

-- Step 2: Add match_source column to candidate_job_matches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'match_source'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN match_source TEXT DEFAULT 'global_match';
    
    -- Update existing records to have global_match
    UPDATE public.candidate_job_matches 
    SET match_source = 'global_match' 
    WHERE match_source IS NULL;
    
    RAISE NOTICE '✅ Added match_source column to candidate_job_matches';
  ELSE
    RAISE NOTICE 'ℹ️  match_source column already exists';
  END IF;
END $$;

-- Step 3: Add last_ranked_at column to candidate_job_matches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'last_ranked_at'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN last_ranked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    
    RAISE NOTICE '✅ Added last_ranked_at column to candidate_job_matches';
  ELSE
    RAISE NOTICE 'ℹ️  last_ranked_at column already exists';
  END IF;
END $$;

-- Step 4: Add applied_at column to candidate_job_matches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'applied_at'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN applied_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    
    RAISE NOTICE '✅ Added applied_at column to candidate_job_matches';
  ELSE
    RAISE NOTICE 'ℹ️  applied_at column already exists';
  END IF;
END $$;

-- Step 5: Add dismissed_at column to candidate_job_matches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'dismissed_at'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    
    RAISE NOTICE '✅ Added dismissed_at column to candidate_job_matches';
  ELSE
    RAISE NOTICE 'ℹ️  dismissed_at column already exists';
  END IF;
END $$;

-- Step 6: Add index for match_source filtering
CREATE INDEX IF NOT EXISTS idx_candidate_job_matches_match_source 
ON public.candidate_job_matches(match_source);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Target candidate IDs migration completed successfully!';
  RAISE NOTICE '📊 Added target_candidate_ids to scraped_jobs';
  RAISE NOTICE '📊 Added match_source, last_ranked_at, applied_at, dismissed_at to candidate_job_matches';
END $$;

