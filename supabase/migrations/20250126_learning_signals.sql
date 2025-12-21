-- ============================================
-- Migration: Learning Signals Table
-- Date: 2025-01-26
-- Purpose: Collect learning data from candidate actions without affecting behavior
-- ============================================

-- Create learning_signals table for tracking candidate actions
CREATE TABLE IF NOT EXISTS public.learning_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.scraped_jobs(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('apply', 'dismiss', 'save')),
  signal_data JSONB DEFAULT '{}'::jsonb, -- Store context: match_score, ai_priority, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_learning_signals_candidate_id 
ON public.learning_signals(candidate_id);

CREATE INDEX IF NOT EXISTS idx_learning_signals_job_id 
ON public.learning_signals(job_id);

CREATE INDEX IF NOT EXISTS idx_learning_signals_action 
ON public.learning_signals(action);

CREATE INDEX IF NOT EXISTS idx_learning_signals_created_at 
ON public.learning_signals(created_at DESC);

-- Add metadata columns to scraped_jobs for learning
-- job_source: derived from uploaded_by (recruiter = manually_curated, scraper = auto)
-- manually_curated: boolean flag (true if uploaded_by = 'recruiter')
-- fallback_primary_platform_used: boolean flag (true if fallback was used)

DO $$
BEGIN
  -- Add manually_curated column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'manually_curated'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN manually_curated BOOLEAN DEFAULT FALSE;
    RAISE NOTICE '✅ Added manually_curated column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  manually_curated column already exists';
  END IF;

  -- Add fallback_primary_platform_used column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'fallback_primary_platform_used'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN fallback_primary_platform_used BOOLEAN DEFAULT FALSE;
    RAISE NOTICE '✅ Added fallback_primary_platform_used column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  fallback_primary_platform_used column already exists';
  END IF;
END $$;

-- Backfill manually_curated from uploaded_by
UPDATE public.scraped_jobs 
SET manually_curated = (uploaded_by = 'recruiter')
WHERE manually_curated IS NULL OR manually_curated = FALSE;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed:';
  RAISE NOTICE '   - learning_signals table created';
  RAISE NOTICE '   - Indexes created';
  RAISE NOTICE '   - manually_curated column added';
  RAISE NOTICE '   - fallback_primary_platform_used column added';
  RAISE NOTICE '   - Values backfilled';
END $$;

