-- ============================================
-- Job Type Support Migration
-- ============================================
-- Adds job_type to scraped_jobs and preferred_job_types to profiles
-- Enforces job type filtering across the platform

-- Step 1: Add job_type column to scraped_jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'job_type'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN job_type TEXT;
    
    RAISE NOTICE '✅ Added job_type column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  job_type column already exists';
  END IF;
END $$;

-- Step 2: Add constraint to ensure valid job_type values
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND constraint_name = 'scraped_jobs_job_type_check'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    DROP CONSTRAINT scraped_jobs_job_type_check;
    
    RAISE NOTICE 'ℹ️  Dropped existing job_type constraint';
  END IF;
  
  -- Add new constraint
  ALTER TABLE public.scraped_jobs
  ADD CONSTRAINT scraped_jobs_job_type_check
  CHECK (job_type IS NULL OR job_type IN ('full-time', 'w2-contract', 'c2c', '1099'));
  
  RAISE NOTICE '✅ Added job_type constraint';
END $$;

-- Step 3: Backfill existing jobs with default job_type
DO $$
BEGIN
  UPDATE public.scraped_jobs
  SET job_type = 'w2-contract'
  WHERE job_type IS NULL;
  
  RAISE NOTICE '✅ Backfilled existing jobs with default job_type = w2-contract';
END $$;

-- Step 4: Add preferred_job_types column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'preferred_job_types'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN preferred_job_types JSONB DEFAULT '[]'::jsonb;
    
    RAISE NOTICE '✅ Added preferred_job_types column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  preferred_job_types column already exists';
  END IF;
END $$;

-- Step 5: Create index on job_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_job_type 
ON public.scraped_jobs(job_type);

-- Step 6: Create GIN index on preferred_job_types for array queries
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_job_types 
ON public.profiles USING GIN(preferred_job_types);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '📊 Columns added: job_type (scraped_jobs), preferred_job_types (profiles)';
  RAISE NOTICE '📊 Constraints: job_type must be one of: full-time, w2-contract, c2c, 1099';
  RAISE NOTICE '📊 Indexes created for performance';
END $$;

