-- ============================================
-- Jobsynt Auth Flow Schema Updates
-- ============================================
-- Add onboarding_complete and user_id to profiles
-- Ensure proper role management
-- ============================================

-- Add onboarding_complete to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for fast onboarding checks
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_complete ON public.profiles(onboarding_complete);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Add role column if not exists (for admin/candidate distinction)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'candidate';

-- Update info@jobsynt.com to admin role and complete onboarding
UPDATE public.profiles
SET role = 'admin', onboarding_complete = true
WHERE email = 'info@jobsynt.com';

-- Ensure all existing profiles without user_id can be linked
-- (This is a one-time migration - new signups will have user_id)

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Auth flow schema updated successfully!';
  RAISE NOTICE '📊 Added: onboarding_complete, user_id, role to profiles';
  RAISE NOTICE '📊 Updated: info@jobsynt.com set as admin with onboarding_complete = true';
END $$;

