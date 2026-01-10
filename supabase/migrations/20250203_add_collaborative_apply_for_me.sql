-- ============================================
-- Collaborative Apply for Me - Database Migration
-- ============================================
-- Adds support for human-in-the-loop automation
-- Safe, additive-only changes

-- ============================================
-- PART 1: Add WAITING_FOR_CANDIDATE status to job_application_runs
-- ============================================
DO $$
BEGIN
  -- Drop existing check constraint
  ALTER TABLE public.job_application_runs 
    DROP CONSTRAINT IF EXISTS job_application_runs_status_check;
  
  -- Add new check constraint with WAITING_FOR_CANDIDATE
  ALTER TABLE public.job_application_runs 
    ADD CONSTRAINT job_application_runs_status_check 
    CHECK (status IN ('pending', 'running', 'submitted', 'failed', 'WAITING_FOR_CANDIDATE'));
  
  RAISE NOTICE '✅ Updated job_application_runs status constraint';
END $$;

-- Add intervention_reason column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'job_application_runs' 
    AND column_name = 'intervention_reason'
  ) THEN
    ALTER TABLE public.job_application_runs 
    ADD COLUMN intervention_reason TEXT;
    
    RAISE NOTICE '✅ Added intervention_reason column to job_application_runs';
  ELSE
    RAISE NOTICE 'ℹ️  intervention_reason column already exists';
  END IF;
END $$;

-- Add intervention_message column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'job_application_runs' 
    AND column_name = 'intervention_message'
  ) THEN
    ALTER TABLE public.job_application_runs 
    ADD COLUMN intervention_message TEXT;
    
    RAISE NOTICE '✅ Added intervention_message column to job_application_runs';
  ELSE
    RAISE NOTICE 'ℹ️  intervention_message column already exists';
  END IF;
END $$;

-- Add paused_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'job_application_runs' 
    AND column_name = 'paused_at'
  ) THEN
    ALTER TABLE public.job_application_runs 
    ADD COLUMN paused_at TIMESTAMPTZ;
    
    RAISE NOTICE '✅ Added paused_at column to job_application_runs';
  ELSE
    RAISE NOTICE 'ℹ️  paused_at column already exists';
  END IF;
END $$;

-- Add resume_token column (for secure resume)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'job_application_runs' 
    AND column_name = 'resume_token'
  ) THEN
    ALTER TABLE public.job_application_runs 
    ADD COLUMN resume_token TEXT;
    
    RAISE NOTICE '✅ Added resume_token column to job_application_runs';
  ELSE
    RAISE NOTICE 'ℹ️  resume_token column already exists';
  END IF;
END $$;

-- ============================================
-- PART 2: Create candidate_site_accounts table
-- ============================================
CREATE TABLE IF NOT EXISTS public.candidate_site_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL,
  site TEXT NOT NULL,
  email TEXT NOT NULL,
  account_status TEXT NOT NULL CHECK (account_status IN ('NOT_CREATED', 'CREATED', 'ACTIVATED', 'VERIFIED')),
  encrypted_credentials JSONB, -- Encrypted password storage
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (candidate_id, site)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_candidate_site_accounts_candidate_id 
ON public.candidate_site_accounts(candidate_id);

CREATE INDEX IF NOT EXISTS idx_candidate_site_accounts_site 
ON public.candidate_site_accounts(site);

CREATE INDEX IF NOT EXISTS idx_candidate_site_accounts_status 
ON public.candidate_site_accounts(account_status);

-- Enable RLS
ALTER TABLE public.candidate_site_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Candidates can view their own site accounts
DO $$
BEGIN
  DROP POLICY IF EXISTS "Candidates can view their own site accounts" ON public.candidate_site_accounts;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Candidates can view their own site accounts"
ON public.candidate_site_accounts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = candidate_site_accounts.candidate_id
    AND profiles.email = auth.jwt() ->> 'email'
  )
);

-- RLS Policy: Admins can view all site accounts
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can view all site accounts" ON public.candidate_site_accounts;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Admins can view all site accounts"
ON public.candidate_site_accounts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role = 'admin'
  )
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_candidate_site_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_candidate_site_accounts_updated_at ON public.candidate_site_accounts;
CREATE TRIGGER trigger_update_candidate_site_accounts_updated_at
  BEFORE UPDATE ON public.candidate_site_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_candidate_site_accounts_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Collaborative Apply for Me migration completed successfully!';
  RAISE NOTICE '📊 Updated job_application_runs: status, intervention_reason, intervention_message, paused_at, resume_token';
  RAISE NOTICE '📊 Created table: candidate_site_accounts (with RLS policies)';
  RAISE NOTICE '📊 Indexes created for performance';
END $$;

