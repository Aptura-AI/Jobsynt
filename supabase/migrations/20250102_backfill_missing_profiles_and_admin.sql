-- ============================================
-- Migration: Backfill Missing Profiles and Admin
-- Date: 2025-01-02
-- Description: Creates profiles for all auth.users that don't have profiles, then sets admin
-- ============================================

-- Step 1: Insert profiles for any auth.users that don't have a profile row
-- This ensures every authenticated user has a profile
-- Note: LEFT JOIN with WHERE p.id IS NULL already prevents duplicates, so ON CONFLICT is not needed
INSERT INTO public.profiles (
  user_id,
  email,
  name,
  role,
  onboarding_complete
)
SELECT 
  au.id AS user_id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', SPLIT_PART(au.email, '@', 1)) AS name,
  'candidate' AS role,
  false AS onboarding_complete
FROM auth.users au
LEFT JOIN public.profiles p ON p.user_id = au.id
WHERE p.id IS NULL
  AND au.email IS NOT NULL;

-- Step 2: Also handle cases where profile exists by email but not user_id
-- Link profiles to auth.users by email if user_id is missing
UPDATE public.profiles p
SET user_id = au.id
FROM auth.users au
WHERE p.email = au.email
  AND p.user_id IS NULL
  AND au.email IS NOT NULL;

-- Step 3: Ensure all profiles have role and onboarding_complete set
-- Set defaults for any NULL values
UPDATE public.profiles
SET 
  role = COALESCE(role, 'candidate'),
  onboarding_complete = COALESCE(onboarding_complete, false)
WHERE role IS NULL OR onboarding_complete IS NULL;

-- Step 4: Set admin user (info@jobsynt.com)
-- This must run AFTER profile creation
UPDATE public.profiles
SET 
  role = 'admin',
  onboarding_complete = true
WHERE email = 'info@jobsynt.com'
  AND (role IS NULL OR role != 'admin' OR onboarding_complete != true);

-- Step 5: If admin profile still doesn't exist, create it
-- This handles the case where info@jobsynt.com exists in auth.users but profile is missing
-- Using NOT EXISTS check instead of ON CONFLICT for safety
INSERT INTO public.profiles (
  user_id,
  email,
  name,
  role,
  onboarding_complete
)
SELECT 
  au.id AS user_id,
  'info@jobsynt.com' AS email,
  'Jobsynt Admin' AS name,
  'admin' AS role,
  true AS onboarding_complete
FROM auth.users au
WHERE au.email = 'info@jobsynt.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.email = 'info@jobsynt.com'
  );

-- Success message with verification
DO $$
DECLARE
  profile_count INTEGER;
  admin_count INTEGER;
BEGIN
  -- Count total profiles
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  
  -- Count admin profiles
  SELECT COUNT(*) INTO admin_count 
  FROM public.profiles 
  WHERE email = 'info@jobsynt.com' AND role = 'admin' AND onboarding_complete = true;
  
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '📊 Total profiles: %', profile_count;
  RAISE NOTICE '📊 Admin profiles (info@jobsynt.com): %', admin_count;
  
  IF admin_count = 0 THEN
    RAISE WARNING '⚠️  Admin profile not found! Please verify info@jobsynt.com exists in auth.users';
  END IF;
END $$;

