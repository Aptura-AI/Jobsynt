-- ============================================
-- Apply for Me Feature - Database Migration
-- ============================================
-- Adds support for automated job application feature
-- Safe, additive-only changes

-- ============================================
-- PART 1: Add resume_json column to profiles
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'resume_json'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN resume_json JSONB DEFAULT NULL;
    
    RAISE NOTICE '✅ Added resume_json column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  resume_json column already exists in profiles';
  END IF;
END $$;

-- ============================================
-- PART 2: Create job_application_runs table
-- ============================================
CREATE TABLE IF NOT EXISTS public.job_application_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL,
  job_id UUID NOT NULL,
  job_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'submitted', 'failed')),
  error TEXT,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_application_runs_candidate_id 
ON public.job_application_runs(candidate_id);

CREATE INDEX IF NOT EXISTS idx_job_application_runs_job_id 
ON public.job_application_runs(job_id);

CREATE INDEX IF NOT EXISTS idx_job_application_runs_status 
ON public.job_application_runs(status);

CREATE INDEX IF NOT EXISTS idx_job_application_runs_created_at 
ON public.job_application_runs(created_at DESC);

-- Enable RLS
ALTER TABLE public.job_application_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Candidates can view their own application runs
DO $$
BEGIN
  DROP POLICY IF EXISTS "Candidates can view their own application runs" ON public.job_application_runs;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Candidates can view their own application runs"
ON public.job_application_runs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = job_application_runs.candidate_id
    AND profiles.email = auth.jwt() ->> 'email'
  )
);

-- RLS Policy: Service role can insert/update (for API)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Service role can manage application runs" ON public.job_application_runs;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Note: Service role operations bypass RLS, so we don't need explicit INSERT/UPDATE policies
-- But we add a policy for admin viewing
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can view all application runs" ON public.job_application_runs;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Admins can view all application runs"
ON public.job_application_runs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role = 'admin'
  )
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_job_application_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_job_application_runs_updated_at ON public.job_application_runs;
CREATE TRIGGER trigger_update_job_application_runs_updated_at
  BEFORE UPDATE ON public.job_application_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_job_application_runs_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Apply for Me database migration completed successfully!';
  RAISE NOTICE '📊 Added to profiles: resume_json (JSONB)';
  RAISE NOTICE '📊 Created table: job_application_runs (with RLS policies)';
  RAISE NOTICE '📊 Indexes created for performance';
END $$;

