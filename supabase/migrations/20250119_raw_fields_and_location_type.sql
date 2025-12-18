-- ============================================
-- Migration: Add raw fields and location_type
-- Date: 2025-01-19
-- Purpose: Store original Excel values + normalized location type
-- ============================================

-- Add raw field columns to preserve original Excel data
ALTER TABLE scraped_jobs
ADD COLUMN IF NOT EXISTS location_raw TEXT;

ALTER TABLE scraped_jobs
ADD COLUMN IF NOT EXISTS pay_rate_raw TEXT;

ALTER TABLE scraped_jobs
ADD COLUMN IF NOT EXISTS description_raw TEXT;

-- Add location_type enum column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraped_jobs' 
    AND column_name = 'location_type'
  ) THEN
    ALTER TABLE scraped_jobs 
    ADD COLUMN location_type TEXT CHECK (location_type IN ('remote', 'hybrid', 'onsite'));
    RAISE NOTICE '✅ Added location_type column';
  ELSE
    RAISE NOTICE 'ℹ️ location_type column already exists';
  END IF;
END $$;

-- Create index on location_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_location_type 
ON scraped_jobs(location_type);

-- Backfill location_type for existing jobs based on location field
UPDATE scraped_jobs
SET location_type = 
  CASE 
    WHEN is_remote = true OR location ILIKE '%remote%' THEN 'remote'
    WHEN location ILIKE '%hybrid%' THEN 'hybrid'
    ELSE 'onsite'
  END
WHERE location_type IS NULL;

-- Verify
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed: raw fields and location_type added';
END $$;

