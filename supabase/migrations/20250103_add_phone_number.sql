-- Add phone/mobile number column to profiles and candidates tables

-- Step 1: Add phone column to profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN phone TEXT;
    
    RAISE NOTICE '✅ Added phone column to profiles table';
  ELSE
    RAISE NOTICE 'ℹ️  Column phone already exists in profiles table';
  END IF;
END $$;

-- Step 2: Add phone column to candidates table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidates' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.candidates
    ADD COLUMN phone TEXT;
    
    RAISE NOTICE '✅ Added phone column to candidates table';
  ELSE
    RAISE NOTICE 'ℹ️  Column phone already exists in candidates table';
  END IF;
END $$;

-- Step 3: Create indexes for phone queries (optional, for search functionality)
CREATE INDEX IF NOT EXISTS idx_profiles_phone 
ON public.profiles(phone) 
WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_phone 
ON public.candidates(phone) 
WHERE phone IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed: phone column added to profiles and candidates tables';
END $$;

