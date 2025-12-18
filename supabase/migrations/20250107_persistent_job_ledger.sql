-- ============================================
-- Persistent Candidate Job Recommendations (Ledger-Based)
-- ============================================
-- This migration ensures candidate_job_matches is a permanent ledger.
-- Jobs are inserted ONCE and never re-processed.
-- Recruiter intent is ALWAYS honored.

-- ============================================
-- Step 1: Ensure all required columns exist on candidate_job_matches
-- ============================================

-- Add fit_score if not exists (alias for match_score)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'fit_score'
  ) THEN
    -- Check if match_score exists, if so create fit_score as alias
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'candidate_job_matches' 
      AND column_name = 'match_score'
    ) THEN
      -- Create fit_score as computed column from match_score
      ALTER TABLE public.candidate_job_matches 
      ADD COLUMN fit_score INTEGER GENERATED ALWAYS AS (match_score) STORED;
      RAISE NOTICE '✅ Added fit_score as computed column from match_score';
    ELSE
      ALTER TABLE public.candidate_job_matches 
      ADD COLUMN fit_score INTEGER DEFAULT 0;
      RAISE NOTICE '✅ Added fit_score column';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️  fit_score column already exists';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'ℹ️  fit_score: %', SQLERRM;
END $$;

-- Add match_source if not exists
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
    
    -- Update existing records
    UPDATE public.candidate_job_matches 
    SET match_source = 'global_match' 
    WHERE match_source IS NULL;
    
    RAISE NOTICE '✅ Added match_source column';
  ELSE
    RAISE NOTICE 'ℹ️  match_source column already exists';
  END IF;
END $$;

-- Add qualified_at (timestamp when job was first matched to candidate)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'qualified_at'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN qualified_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    
    -- Backfill from created_at if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'candidate_job_matches' 
      AND column_name = 'created_at'
    ) THEN
      UPDATE public.candidate_job_matches 
      SET qualified_at = created_at 
      WHERE qualified_at IS NULL;
    END IF;
    
    RAISE NOTICE '✅ Added qualified_at column';
  ELSE
    RAISE NOTICE 'ℹ️  qualified_at column already exists';
  END IF;
END $$;

-- Add applied_at (timestamp when candidate applied)
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
    RAISE NOTICE '✅ Added applied_at column';
  ELSE
    RAISE NOTICE 'ℹ️  applied_at column already exists';
  END IF;
END $$;

-- Add dismissed_at (timestamp when candidate dismissed)
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
    RAISE NOTICE '✅ Added dismissed_at column';
  ELSE
    RAISE NOTICE 'ℹ️  dismissed_at column already exists';
  END IF;
END $$;

-- Add last_ranked_at (timestamp when AI last ranked this job)
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
    RAISE NOTICE '✅ Added last_ranked_at column';
  ELSE
    RAISE NOTICE 'ℹ️  last_ranked_at column already exists';
  END IF;
END $$;

-- Add ai_priority for AI ranking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'ai_priority'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN ai_priority TEXT DEFAULT NULL;
    RAISE NOTICE '✅ Added ai_priority column';
  ELSE
    RAISE NOTICE 'ℹ️  ai_priority column already exists';
  END IF;
END $$;

-- ============================================
-- Step 2: Ensure unique constraint on (candidate_id, job_id)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'candidate_job_matches_unique_pair'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD CONSTRAINT candidate_job_matches_unique_pair 
    UNIQUE (candidate_id, job_id);
    RAISE NOTICE '✅ Added unique constraint on (candidate_id, job_id)';
  ELSE
    RAISE NOTICE 'ℹ️  Unique constraint already exists';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'ℹ️  Unique constraint: %', SQLERRM;
END $$;

-- ============================================
-- Step 3: Create indexes for efficient querying
-- ============================================

-- Index for active feed query (most common)
CREATE INDEX IF NOT EXISTS idx_cjm_active_feed 
ON public.candidate_job_matches(candidate_id, applied_at, dismissed_at, qualified_at DESC);

-- Index for match_source priority ordering
CREATE INDEX IF NOT EXISTS idx_cjm_match_source 
ON public.candidate_job_matches(candidate_id, match_source);

-- Index for AI priority
CREATE INDEX IF NOT EXISTS idx_cjm_ai_priority 
ON public.candidate_job_matches(candidate_id, ai_priority);

-- ============================================
-- Step 4: Create job_qualification_log table for audit trail
-- ============================================
CREATE TABLE IF NOT EXISTS public.job_qualification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL,
  job_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'qualified', 'applied', 'dismissed', 'expired'
  reason TEXT,
  match_source TEXT,
  fit_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_jql_candidate_job 
ON public.job_qualification_log(candidate_id, job_id);

CREATE INDEX IF NOT EXISTS idx_jql_action 
ON public.job_qualification_log(action);

-- ============================================
-- Success message
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Persistent Job Ledger migration completed!';
  RAISE NOTICE '📊 candidate_job_matches is now the single source of truth';
  RAISE NOTICE '📊 Jobs are inserted ONCE and never re-processed';
  RAISE NOTICE '📊 job_qualification_log provides audit trail';
END $$;

