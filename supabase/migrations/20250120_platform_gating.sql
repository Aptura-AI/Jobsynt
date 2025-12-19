-- ============================================
-- PLATFORM GATING MIGRATION
-- ============================================
-- Adds platform identity fields and visibility_status to prevent
-- cross-platform job recommendations (e.g., PeopleSoft + Oracle Fusion)

-- ============================================
-- PART 1: Add Platform Fields to Profiles
-- ============================================

-- Add primary_platform (required, candidate's main platform)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'primary_platform'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN primary_platform TEXT DEFAULT NULL;
    RAISE NOTICE '✅ Added primary_platform column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  primary_platform column already exists in profiles';
  END IF;
END $$;

-- Add secondary_platforms (array of platforms candidate works with)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'secondary_platforms'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN secondary_platforms TEXT[] DEFAULT NULL;
    RAISE NOTICE '✅ Added secondary_platforms column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  secondary_platforms column already exists in profiles';
  END IF;
END $$;

-- Add transferable_platforms (platforms candidate has exposure to)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'transferable_platforms'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN transferable_platforms TEXT[] DEFAULT NULL;
    RAISE NOTICE '✅ Added transferable_platforms column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  transferable_platforms column already exists in profiles';
  END IF;
END $$;

-- ============================================
-- PART 2: Add Platform Fields to scraped_jobs
-- ============================================

-- Add primary_platform (required, job's main platform)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'primary_platform'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN primary_platform TEXT DEFAULT NULL;
    RAISE NOTICE '✅ Added primary_platform column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  primary_platform column already exists in scraped_jobs';
  END IF;
END $$;

-- Add secondary_platforms (array of platforms job involves)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'secondary_platforms'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN secondary_platforms TEXT[] DEFAULT NULL;
    RAISE NOTICE '✅ Added secondary_platforms column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  secondary_platforms column already exists in scraped_jobs';
  END IF;
END $$;

-- ============================================
-- PART 3: Add Visibility Status to candidate_job_matches
-- ============================================

-- Add visibility_status (stores visibility state, not derived)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'visibility_status'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN visibility_status TEXT DEFAULT 'visible' 
    CHECK (visibility_status IN ('visible', 'hidden_by_ai', 'dismissed_by_user'));
    RAISE NOTICE '✅ Added visibility_status column to candidate_job_matches';
  ELSE
    RAISE NOTICE 'ℹ️  visibility_status column already exists in candidate_job_matches';
  END IF;
END $$;

-- Add hidden_reason (explains why job is hidden)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'hidden_reason'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN hidden_reason TEXT DEFAULT NULL;
    RAISE NOTICE '✅ Added hidden_reason column to candidate_job_matches';
  ELSE
    RAISE NOTICE 'ℹ️  hidden_reason column already exists in candidate_job_matches';
  END IF;
END $$;

-- Add hidden_at (timestamp when job was hidden)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'hidden_at'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN hidden_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    RAISE NOTICE '✅ Added hidden_at column to candidate_job_matches';
  ELSE
    RAISE NOTICE 'ℹ️  hidden_at column already exists in candidate_job_matches';
  END IF;
END $$;

-- ============================================
-- PART 4: Backfill Existing Rows
-- ============================================

-- Set default visibility_status for existing rows
UPDATE public.candidate_job_matches
SET visibility_status = 'visible'
WHERE visibility_status IS NULL;

-- ============================================
-- PART 5: Create Index for Performance
-- ============================================

-- Index for visibility_status queries
CREATE INDEX IF NOT EXISTS idx_candidate_job_matches_visibility 
ON public.candidate_job_matches(candidate_id, visibility_status) 
WHERE visibility_status = 'visible';

-- Index for platform queries
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_primary_platform 
ON public.scraped_jobs(primary_platform);

CREATE INDEX IF NOT EXISTS idx_profiles_primary_platform 
ON public.profiles(primary_platform);

RAISE NOTICE '✅ Platform gating migration complete';

