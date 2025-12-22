-- ============================================
-- Migration: Add trial_ends_at to profiles
-- Date: 2025-01-28
-- Purpose: Add nullable trial_ends_at column for 7-day free trial support
-- 
-- REVERSIBLE: To rollback, run:
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS trial_ends_at;
-- ============================================

-- Add trial_ends_at column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN trial_ends_at TIMESTAMPTZ;
    
    RAISE NOTICE '✅ Added trial_ends_at column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  trial_ends_at column already exists';
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed:';
  RAISE NOTICE '   - trial_ends_at column added to profiles table';
END $$;

