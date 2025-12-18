-- ============================================
-- Matching Architecture Rework Migration
-- ============================================
-- Implements deterministic-first job matching with candidate_job_matches table
-- Adds new fields to scraped_jobs for enhanced matching

-- Step 1: Create enum type if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'location_type_enum') THEN
    CREATE TYPE location_type_enum AS ENUM ('Onsite', 'Hybrid', 'Remote');
    RAISE NOTICE '✅ Created location_type_enum type';
  ELSE
    RAISE NOTICE 'ℹ️  location_type_enum type already exists';
  END IF;
END $$;

-- Step 2: Add location_type to scraped_jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'location_type'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN location_type location_type_enum;
    
    -- Set location_type based on is_remote
    UPDATE public.scraped_jobs 
    SET location_type = CASE 
      WHEN is_remote = true THEN 'Remote'::location_type_enum
      WHEN LOWER(location) LIKE '%hybrid%' THEN 'Hybrid'::location_type_enum
      ELSE 'Onsite'::location_type_enum
    END
    WHERE location_type IS NULL;
    
    RAISE NOTICE '✅ Added location_type column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  location_type column already exists';
  END IF;
END $$;

-- Step 2: Add must_have_skills and good_to_have_skills
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'must_have_skills'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN must_have_skills TEXT;
    
    RAISE NOTICE '✅ Added must_have_skills column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  must_have_skills column already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'good_to_have_skills'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN good_to_have_skills TEXT;
    
    RAISE NOTICE '✅ Added good_to_have_skills column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  good_to_have_skills column already exists';
  END IF;
END $$;

-- Step 3: Add education_required and certification_required
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'education_required'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN education_required TEXT;
    
    RAISE NOTICE '✅ Added education_required column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  education_required column already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'certification_required'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN certification_required TEXT;
    
    RAISE NOTICE '✅ Added certification_required column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  certification_required column already exists';
  END IF;
END $$;

-- Step 4: Create candidate_job_matches table
CREATE TABLE IF NOT EXISTS public.candidate_job_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.scraped_jobs(id) ON DELETE CASCADE,
  match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  reasons JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one match record per candidate-job pair
  UNIQUE(candidate_id, job_id)
);

-- Step 5: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidate_job_matches_candidate_id 
ON public.candidate_job_matches(candidate_id);

CREATE INDEX IF NOT EXISTS idx_candidate_job_matches_job_id 
ON public.candidate_job_matches(job_id);

CREATE INDEX IF NOT EXISTS idx_candidate_job_matches_match_score 
ON public.candidate_job_matches(match_score);

CREATE INDEX IF NOT EXISTS idx_candidate_job_matches_created_at 
ON public.candidate_job_matches(created_at DESC);

-- Step 6: Add resume_text column to profiles (for storing parsed resume text separately)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'resume_text'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN resume_text TEXT;
    
    RAISE NOTICE '✅ Added resume_text column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  resume_text column already exists';
  END IF;
END $$;

-- Step 7: Make visa_status NOT NULL (mandatory)
DO $$
BEGIN
  -- First, set any NULL values to empty string
  UPDATE public.profiles 
  SET visa_status = '' 
  WHERE visa_status IS NULL;
  
  -- Then alter column to NOT NULL
  ALTER TABLE public.profiles 
  ALTER COLUMN visa_status SET NOT NULL,
  ALTER COLUMN visa_status SET DEFAULT '';
  
  RAISE NOTICE '✅ Made visa_status mandatory in profiles';
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'ℹ️  Could not make visa_status NOT NULL (may already be set or have constraints)';
END $$;

-- Step 8: Add RLS policies for candidate_job_matches
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view their own job matches" ON public.candidate_job_matches;
  DROP POLICY IF EXISTS "Users can insert their own job matches" ON public.candidate_job_matches;
  DROP POLICY IF EXISTS "Users can update their own job matches" ON public.candidate_job_matches;
  
  -- Create new policies
  CREATE POLICY "Users can view their own job matches"
    ON public.candidate_job_matches
    FOR SELECT
    USING (
      candidate_id IN (
        SELECT id FROM public.profiles 
        WHERE email = auth.jwt() ->> 'email'
      )
    );
  
  CREATE POLICY "Users can insert their own job matches"
    ON public.candidate_job_matches
    FOR INSERT
    WITH CHECK (
      candidate_id IN (
        SELECT id FROM public.profiles 
        WHERE email = auth.jwt() ->> 'email'
      )
    );
  
  CREATE POLICY "Users can update their own job matches"
    ON public.candidate_job_matches
    FOR UPDATE
    USING (
      candidate_id IN (
        SELECT id FROM public.profiles 
        WHERE email = auth.jwt() ->> 'email'
      )
    );
  
  RAISE NOTICE '✅ Created RLS policies for candidate_job_matches';
END $$;

-- Step 9: Enable RLS on candidate_job_matches
ALTER TABLE public.candidate_job_matches ENABLE ROW LEVEL SECURITY;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Matching architecture rework migration completed successfully!';
  RAISE NOTICE '📊 Added to scraped_jobs: location_type, must_have_skills, good_to_have_skills, education_required, certification_required';
  RAISE NOTICE '📊 Created candidate_job_matches table for deterministic matching results';
  RAISE NOTICE '📊 Added resume_text column to profiles';
  RAISE NOTICE '📊 Made visa_status mandatory in profiles';
END $$;

