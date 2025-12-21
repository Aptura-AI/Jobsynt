-- ============================================
-- Migration: Production Guardrails
-- Date: 2025-01-25
-- Purpose: 
--   1. Add daily_email_sent_at to profiles for email idempotency
--   2. Create cron_runs table for cron execution tracking
-- ============================================

-- PART 1: Email Idempotency Guard
-- Add daily_email_sent_at timestamp to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS daily_email_sent_at TIMESTAMPTZ;

-- PART 2: Cron Run Tracking Table
CREATE TABLE IF NOT EXISTS cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying recent runs
CREATE INDEX IF NOT EXISTS idx_cron_runs_cron_name_started_at 
ON cron_runs(cron_name, started_at DESC);

-- Index for querying by status
CREATE INDEX IF NOT EXISTS idx_cron_runs_status 
ON cron_runs(status, started_at DESC);

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed:';
  RAISE NOTICE '   - daily_email_sent_at added to profiles';
  RAISE NOTICE '   - cron_runs table created';
  RAISE NOTICE '   - Indexes created';
END $$;

