-- ============================================
-- LEDGER HARDENING MIGRATION
-- ============================================
-- Adds visibility_status, view tracking, and proper constraints
-- for the ledger-based job recommendation system.

-- ============================================
-- PART 1: Add View Tracking Columns
-- ============================================

-- Add first_seen_at (when job first appeared in dashboard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'first_seen_at'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    RAISE NOTICE '✅ Added first_seen_at column';
  ELSE
    RAISE NOTICE 'ℹ️  first_seen_at column already exists';
  END IF;
END $$;

-- Add last_seen_at (updated on each dashboard load)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'last_seen_at'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    RAISE NOTICE '✅ Added last_seen_at column';
  ELSE
    RAISE NOTICE 'ℹ️  last_seen_at column already exists';
  END IF;
END $$;

-- ============================================
-- PART 2: Add Visibility Status (Derived Column)
-- ============================================
-- This is a GENERATED column that derives status from other fields
-- Rules:
--   applied_at IS NOT NULL → 'applied'
--   dismissed_at IS NOT NULL → 'dismissed'
--   Else → 'active' (expiry is checked at query time with posted_date)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'visibility_status'
  ) THEN
    -- Add as a generated column
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN visibility_status TEXT GENERATED ALWAYS AS (
      CASE 
        WHEN applied_at IS NOT NULL THEN 'applied'
        WHEN dismissed_at IS NOT NULL THEN 'dismissed'
        ELSE 'active'
      END
    ) STORED;
    RAISE NOTICE '✅ Added visibility_status generated column';
  ELSE
    RAISE NOTICE 'ℹ️  visibility_status column already exists';
  END IF;
EXCEPTION WHEN others THEN
  -- If generated column fails, add as regular column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidate_job_matches' 
    AND column_name = 'visibility_status'
  ) THEN
    ALTER TABLE public.candidate_job_matches 
    ADD COLUMN visibility_status TEXT DEFAULT 'active';
    RAISE NOTICE '⚠️  Added visibility_status as regular column (update trigger needed)';
  END IF;
END $$;

-- ============================================
-- PART 3: Create Indexes for Performance
-- ============================================

-- Index for visibility queries
CREATE INDEX IF NOT EXISTS idx_cjm_visibility_status 
ON public.candidate_job_matches(candidate_id, visibility_status);

-- Index for view tracking queries
CREATE INDEX IF NOT EXISTS idx_cjm_first_seen 
ON public.candidate_job_matches(candidate_id, first_seen_at);

CREATE INDEX IF NOT EXISTS idx_cjm_last_seen 
ON public.candidate_job_matches(candidate_id, last_seen_at);

-- Index for AI ranking guard (last_ranked_at)
CREATE INDEX IF NOT EXISTS idx_cjm_last_ranked 
ON public.candidate_job_matches(candidate_id, last_ranked_at);

-- Composite index for active feed query
CREATE INDEX IF NOT EXISTS idx_cjm_active_feed_optimized 
ON public.candidate_job_matches(candidate_id, visibility_status, ai_priority, match_score DESC);

-- ============================================
-- PART 4: Create or Update email_events table
-- ============================================

-- First, create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  metadata JSONB DEFAULT NULL
);

-- Add email_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'email_events' 
    AND column_name = 'email_type'
  ) THEN
    ALTER TABLE public.email_events 
    ADD COLUMN email_type TEXT NOT NULL DEFAULT 'daily_jobs';
    RAISE NOTICE '✅ Added email_type column to email_events';
  ELSE
    RAISE NOTICE 'ℹ️  email_type column already exists';
  END IF;
END $$;

-- Add job_ids column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'email_events' 
    AND column_name = 'job_ids'
  ) THEN
    ALTER TABLE public.email_events 
    ADD COLUMN job_ids UUID[] DEFAULT NULL;
    RAISE NOTICE '✅ Added job_ids column to email_events';
  ELSE
    RAISE NOTICE 'ℹ️  job_ids column already exists';
  END IF;
END $$;

-- Indexes for email events (only create if columns exist)
CREATE INDEX IF NOT EXISTS idx_email_events_candidate 
ON public.email_events(candidate_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_events_type 
ON public.email_events(email_type, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_events_opened 
ON public.email_events(opened_at);

-- ============================================
-- PART 5: Create admin_kpi_snapshots table for historical tracking
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Candidate Engagement
  total_candidates INTEGER DEFAULT 0,
  candidates_with_qualified_jobs INTEGER DEFAULT 0,
  candidates_with_active_jobs INTEGER DEFAULT 0,
  candidates_inactive_7d INTEGER DEFAULT 0,
  
  -- Job Flow Health
  total_jobs_ingested INTEGER DEFAULT 0,
  jobs_explicitly_targeted INTEGER DEFAULT 0,
  jobs_matched_globally INTEGER DEFAULT 0,
  jobs_expired_unseen INTEGER DEFAULT 0,
  jobs_applied INTEGER DEFAULT 0,
  jobs_dismissed INTEGER DEFAULT 0,
  
  -- AI Effectiveness
  avg_fit_score NUMERIC(5,2) DEFAULT 0,
  high_priority_count INTEGER DEFAULT 0,
  medium_priority_count INTEGER DEFAULT 0,
  low_priority_count INTEGER DEFAULT 0,
  high_priority_applied_7d INTEGER DEFAULT 0,
  avg_qualification_to_apply_hours NUMERIC(8,2) DEFAULT NULL,
  
  -- Email Performance
  emails_sent_24h INTEGER DEFAULT 0,
  emails_opened_24h INTEGER DEFAULT 0,
  emails_sent_7d INTEGER DEFAULT 0,
  emails_opened_7d INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_date 
ON public.admin_kpi_snapshots(snapshot_date DESC);

-- ============================================
-- Success message
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Ledger Hardening migration completed!';
  RAISE NOTICE '📊 Added: visibility_status, first_seen_at, last_seen_at';
  RAISE NOTICE '📊 Created: email_events, admin_kpi_snapshots tables';
  RAISE NOTICE '📊 Created performance indexes';
END $$;
