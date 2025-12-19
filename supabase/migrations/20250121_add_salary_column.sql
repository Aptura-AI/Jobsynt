-- ============================================
-- Add salary column to scraped_jobs
-- ============================================
-- The salary column is used throughout the codebase but was missing from schema
-- This migration adds it for backward compatibility

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'salary'
  ) THEN
    ALTER TABLE public.scraped_jobs 
    ADD COLUMN salary TEXT DEFAULT NULL;
    
    RAISE NOTICE '✅ Added salary column to scraped_jobs';
  ELSE
    RAISE NOTICE 'ℹ️  salary column already exists in scraped_jobs';
  END IF;
END $$;

