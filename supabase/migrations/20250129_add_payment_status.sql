-- ============================================
-- Migration: Add payment status to profiles
-- Date: 2025-01-29
-- Purpose: Add is_paid and paid_at columns for payment tracking
-- 
-- REVERSIBLE: To rollback, run:
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_paid;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS paid_at;
-- ============================================

-- Add is_paid column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'is_paid'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT false;
    
    RAISE NOTICE '✅ Added is_paid column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  is_paid column already exists';
  END IF;
END $$;

-- Add paid_at column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN paid_at TIMESTAMPTZ;
    
    RAISE NOTICE '✅ Added paid_at column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  paid_at column already exists';
  END IF;
END $$;

-- Index on is_paid for querying paid users
CREATE INDEX IF NOT EXISTS idx_profiles_is_paid 
ON public.profiles(is_paid) 
WHERE is_paid = true;

-- Index on paid_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_paid_at 
ON public.profiles(paid_at) 
WHERE paid_at IS NOT NULL;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed:';
  RAISE NOTICE '   - is_paid column added to profiles table';
  RAISE NOTICE '   - paid_at column added to profiles table';
  RAISE NOTICE '   - Indexes created';
END $$;

