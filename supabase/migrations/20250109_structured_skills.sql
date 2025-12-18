-- ============================================
-- STRUCTURED SKILLS MIGRATION
-- ============================================
-- Adds structured skill categorization to candidate profiles
-- and skill validation tracking to job matches.

-- ============================================
-- PART 1: Add Structured Skill Columns to Profiles
-- ============================================

-- Primary Skills (Stack/Platform) - Max 3
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'primary_skills'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN primary_skills TEXT[] DEFAULT '{}';
    RAISE NOTICE '✅ Added primary_skills column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  primary_skills column already exists';
  END IF;
END $$;

-- Secondary Skills (Ecosystem/Frameworks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'secondary_skills'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN secondary_skills TEXT[] DEFAULT '{}';
    RAISE NOTICE '✅ Added secondary_skills column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  secondary_skills column already exists';
  END IF;
END $$;

-- Adjacent Skills (Transferable/Exposure)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'adjacent_skills'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN adjacent_skills TEXT[] DEFAULT '{}';
    RAISE NOTICE '✅ Added adjacent_skills column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  adjacent_skills column already exists';
  END IF;
END $$;

-- Generic Skills (Domain/Cross-platform)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'generic_skills'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN generic_skills TEXT[] DEFAULT '{}';
    RAISE NOTICE '✅ Added generic_skills column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  generic_skills column already exists';
  END IF;
END $$;

-- ============================================
-- PART 2: Add Skill Validation Columns to Matches
-- ============================================

-- Primary stack source: where did we determine the primary stack from?
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'primary_stack_source'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN primary_stack_source TEXT DEFAULT 'candidate';
    RAISE NOTICE '✅ Added primary_stack_source column to candidate_job_matches';
  ELSE
    RAISE NOTICE 'ℹ️  primary_stack_source column already exists';
  END IF;
END $$;

-- Skill confidence level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'skill_confidence'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN skill_confidence TEXT DEFAULT 'Medium';
    RAISE NOTICE '✅ Added skill_confidence column to candidate_job_matches';
  ELSE
    RAISE NOTICE 'ℹ️  skill_confidence column already exists';
  END IF;
END $$;

-- Mismatch notes (for debugging/audit)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'mismatch_notes'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN mismatch_notes TEXT DEFAULT NULL;
    RAISE NOTICE '✅ Added mismatch_notes column to candidate_job_matches';
  ELSE
    RAISE NOTICE 'ℹ️  mismatch_notes column already exists';
  END IF;
END $$;

-- ============================================
-- PART 3: Create Indexes
-- ============================================

-- Index for primary skills array queries
CREATE INDEX IF NOT EXISTS idx_profiles_primary_skills 
ON public.profiles USING GIN (primary_skills);

CREATE INDEX IF NOT EXISTS idx_profiles_secondary_skills 
ON public.profiles USING GIN (secondary_skills);

-- Index for skill confidence filtering
CREATE INDEX IF NOT EXISTS idx_cjm_skill_confidence 
ON public.candidate_job_matches(skill_confidence);

-- ============================================
-- Success message
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Structured Skills migration completed!';
  RAISE NOTICE '📊 Added to profiles: primary_skills, secondary_skills, adjacent_skills, generic_skills';
  RAISE NOTICE '📊 Added to candidate_job_matches: primary_stack_source, skill_confidence, mismatch_notes';
END $$;

