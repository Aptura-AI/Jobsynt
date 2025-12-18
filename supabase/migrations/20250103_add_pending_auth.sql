-- Add pending_auth column to profiles table
-- This indicates if a profile was created by admin but user hasn't authenticated yet

-- Step 1: Add pending_auth column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'pending_auth'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN pending_auth BOOLEAN NOT NULL DEFAULT false;
    
    RAISE NOTICE '✅ Added pending_auth column to profiles table';
  ELSE
    RAISE NOTICE 'ℹ️  Column pending_auth already exists in profiles table';
  END IF;
END $$;

-- Step 2: Create index for pending_auth queries
CREATE INDEX IF NOT EXISTS idx_profiles_pending_auth 
ON public.profiles(pending_auth) 
WHERE pending_auth = true;

-- Step 3: Set pending_auth = false for existing profiles that have user_id (already authenticated)
DO $$
BEGIN
  UPDATE public.profiles
  SET pending_auth = false
  WHERE user_id IS NOT NULL;
  
  RAISE NOTICE '✅ Migration completed: pending_auth column added';
END $$;

