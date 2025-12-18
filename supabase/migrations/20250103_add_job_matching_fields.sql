-- ============================================
-- Job Matching Fields Migration
-- ============================================
-- Adds fields needed for deterministic job matching
-- These fields support hard filtering and scoring before AI processing

-- Step 1: Add skills array to scraped_jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'skills'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN skills JSONB DEFAULT '[]'::jsonb;
    
    RAISE NOTICE '✅ Added skills column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  skills column already exists';
  END IF;
END $$;

-- Step 2: Add required_years_experience
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'required_years_experience'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN required_years_experience INTEGER;
    
    RAISE NOTICE '✅ Added required_years_experience column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  required_years_experience column already exists';
  END IF;
END $$;

-- Step 3: Add required_degree
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'required_degree'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN required_degree TEXT;
    
    RAISE NOTICE '✅ Added required_degree column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  required_degree column already exists';
  END IF;
END $$;

-- Step 4: Add pay_rate_min and pay_rate_max
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'pay_rate_min'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN pay_rate_min NUMERIC;
    
    RAISE NOTICE '✅ Added pay_rate_min column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  pay_rate_min column already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'pay_rate_max'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN pay_rate_max NUMERIC;
    
    RAISE NOTICE '✅ Added pay_rate_max column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  pay_rate_max column already exists';
  END IF;
END $$;

-- Step 5: Add is_remote (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'is_remote'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN is_remote BOOLEAN DEFAULT false;
    
    RAISE NOTICE '✅ Added is_remote column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  is_remote column already exists';
  END IF;
END $$;

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_skills 
ON public.scraped_jobs USING GIN(skills);

CREATE INDEX IF NOT EXISTS idx_scraped_jobs_is_remote 
ON public.scraped_jobs(is_remote);

CREATE INDEX IF NOT EXISTS idx_scraped_jobs_pay_rate_min 
ON public.scraped_jobs(pay_rate_min);

-- Step 7: Ensure profiles has expected_pay_min (for candidate preferences)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'expected_pay_min'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN expected_pay_min NUMERIC;
    
    RAISE NOTICE '✅ Added expected_pay_min column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  expected_pay_min column already exists';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Job matching fields migration completed successfully!';
  RAISE NOTICE '📊 Added to scraped_jobs: skills, required_years_experience, required_degree, pay_rate_min, pay_rate_max, is_remote';
  RAISE NOTICE '📊 Added to profiles: expected_pay_min';
  RAISE NOTICE '📊 Indexes created for performance';
END $$;

