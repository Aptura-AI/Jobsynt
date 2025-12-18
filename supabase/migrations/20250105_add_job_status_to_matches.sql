-- ============================================
-- Add Job Status to candidate_job_matches
-- ============================================
-- Adds job_status field for tracking job lifecycle and AI memory

-- Step 1: Create job_status enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status_enum') THEN
    CREATE TYPE job_status_enum AS ENUM ('active', 'applied', 'dismissed', 'expired');
    RAISE NOTICE '✅ Created job_status_enum type';
  ELSE
    RAISE NOTICE 'ℹ️  job_status_enum type already exists';
  END IF;
END $$;

-- Step 2: Add job_status column to candidate_job_matches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'job_status'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN job_status job_status_enum DEFAULT 'active';
    
    -- Set all existing records to 'active'
    UPDATE public.candidate_job_matches 
    SET job_status = 'active' 
    WHERE job_status IS NULL;
    
    RAISE NOTICE '✅ Added job_status column to candidate_job_matches';
  ELSE
    RAISE NOTICE 'ℹ️  job_status column already exists';
  END IF;
END $$;

-- Step 3: Add index for job_status filtering
CREATE INDEX IF NOT EXISTS idx_candidate_job_matches_job_status 
ON public.candidate_job_matches(job_status);

-- Step 4: Add index for active jobs only (most common query)
CREATE INDEX IF NOT EXISTS idx_candidate_job_matches_active 
ON public.candidate_job_matches(candidate_id, match_score DESC) 
WHERE job_status = 'active';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Job status migration completed successfully!';
  RAISE NOTICE '📊 Added job_status enum: active, applied, dismissed, expired';
  RAISE NOTICE '📊 All existing matches set to active';
  RAISE NOTICE '📊 Indexes created for performance';
END $$;

