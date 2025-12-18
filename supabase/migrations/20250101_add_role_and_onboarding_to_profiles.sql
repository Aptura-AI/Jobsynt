-- ============================================
-- Migration: Add role and onboarding_complete to profiles
-- Date: 2025-01-01
-- Description: Safely adds role and onboarding_complete columns with proper constraints
-- ============================================

-- Step 1: Add role column if not exists (with NOT NULL and DEFAULT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN role TEXT NOT NULL DEFAULT 'candidate';
    
    RAISE NOTICE '✅ Added role column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  role column already exists';
  END IF;
END $$;

-- Step 2: Add onboarding_complete column if not exists (with NOT NULL and DEFAULT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'onboarding_complete'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN onboarding_complete BOOLEAN NOT NULL DEFAULT false;
    
    RAISE NOTICE '✅ Added onboarding_complete column to profiles';
  ELSE
    RAISE NOTICE 'ℹ️  onboarding_complete column already exists';
  END IF;
END $$;

-- Step 3: Ensure user_id column exists with proper foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    
    RAISE NOTICE '✅ Added user_id column to profiles';
  ELSE
    -- Ensure foreign key constraint exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND table_name = 'profiles' 
      AND constraint_name LIKE '%user_id%'
    ) THEN
      -- Add foreign key if column exists but constraint doesn't
      ALTER TABLE public.profiles 
      ADD CONSTRAINT profiles_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      
      RAISE NOTICE '✅ Added foreign key constraint for user_id';
    END IF;
  END IF;
END $$;

-- Step 4: Add UNIQUE constraint on user_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'profiles' 
    AND constraint_type = 'UNIQUE'
    AND constraint_name LIKE '%user_id%'
  ) THEN
    -- Check if there are duplicate user_ids before adding constraint
    IF NOT EXISTS (
      SELECT user_id FROM public.profiles 
      WHERE user_id IS NOT NULL 
      GROUP BY user_id 
      HAVING COUNT(*) > 1
    ) THEN
      CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique 
      ON public.profiles(user_id) 
      WHERE user_id IS NOT NULL;
      
      RAISE NOTICE '✅ Added UNIQUE constraint on user_id';
    ELSE
      RAISE WARNING '⚠️  Duplicate user_ids found. Please clean up before adding UNIQUE constraint.';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️  UNIQUE constraint on user_id already exists';
  END IF;
END $$;

-- Step 5: Backfill admin user (info@jobsynt.com)
-- This must run AFTER the columns exist
UPDATE public.profiles
SET 
  role = 'admin',
  onboarding_complete = true
WHERE email = 'info@jobsynt.com'
  AND (role IS NULL OR role != 'admin' OR onboarding_complete != true);

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_complete ON public.profiles(onboarding_complete);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Step 7: Ensure all existing profiles have role = 'candidate' if null
UPDATE public.profiles
SET role = 'candidate'
WHERE role IS NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '📊 Columns added/verified: role, onboarding_complete, user_id';
  RAISE NOTICE '📊 Admin user backfilled: info@jobsynt.com → role=admin, onboarding_complete=true';
  RAISE NOTICE '📊 Indexes created for performance';
END $$;

