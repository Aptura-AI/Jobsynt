-- Fix: Update notification trigger function with correct project URL
-- Date: 2025-01-31
-- Purpose: Drop and recreate triggers/function with correct Supabase project URL
-- 
-- INSTRUCTIONS:
-- 1. Replace 'https://your-project-ref.supabase.co' with your actual Supabase project URL
-- 2. (Optional) Replace 'your-anon-key' with your Supabase anon key
-- 3. Run this script

-- Step 1: Drop existing triggers (if they exist)
DROP TRIGGER IF EXISTS trigger_notify_candidate_registration ON public.profiles;
DROP TRIGGER IF EXISTS trigger_notify_candidate_completion ON public.profiles;

-- Step 2: Drop existing function (if it exists)
DROP FUNCTION IF EXISTS notify_candidate_action();

-- Step 3: Recreate function with CORRECT project URL
-- ⚠️ IMPORTANT: Replace 'https://your-project-ref.supabase.co' with your actual Supabase project URL
-- You can find this in: Supabase Dashboard → Settings → API → Project URL
CREATE OR REPLACE FUNCTION notify_candidate_action()
RETURNS TRIGGER AS $$
DECLARE
  action_type TEXT;
  edge_function_url TEXT;
  supabase_url TEXT;
  function_secret TEXT;
  payload JSONB;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_type := 'registration';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only notify on profile completion (onboarding_complete changes from false to true)
    IF OLD.onboarding_complete = false AND NEW.onboarding_complete = true THEN
      action_type := 'completion';
    ELSE
      -- Not a completion event, skip notification
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Get Supabase project URL from database setting (set it below)
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- Fallback: If not set, use the hardcoded value (UPDATE THIS!)
  IF supabase_url IS NULL OR supabase_url = '' THEN
    -- ⚠️ REPLACE THIS WITH YOUR ACTUAL SUPABASE PROJECT URL
    supabase_url := 'https://your-project-ref.supabase.co';
  END IF;

  -- Construct Edge Function URL
  edge_function_url := supabase_url || '/functions/v1/send-candidate-notification';

  -- Get function secret (Supabase anon key)
  function_secret := current_setting('app.settings.supabase_anon_key', true);
  
  IF function_secret IS NULL OR function_secret = '' THEN
    -- ⚠️ OPTIONAL: Replace with your anon key if you want to use it
    function_secret := '';
  END IF;

  -- Build payload with all profile data
  payload := jsonb_build_object(
    'profile', to_jsonb(NEW),
    'action', action_type
  );

  -- Call Edge Function via HTTP using pg_net (async, non-blocking)
  BEGIN
    PERFORM net.http_post(
      edge_function_url,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(function_secret, '')
      ),
      payload::text
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE WARNING 'Error calling notification function: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Error in notify_candidate_action: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Recreate triggers
CREATE TRIGGER trigger_notify_candidate_registration
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.role = 'candidate')
  EXECUTE FUNCTION notify_candidate_action();

CREATE TRIGGER trigger_notify_candidate_completion
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (
    NEW.role = 'candidate' 
    AND OLD.onboarding_complete = false 
    AND NEW.onboarding_complete = true
  )
  EXECUTE FUNCTION notify_candidate_action();

-- Step 5: Set the correct project URL in database settings
-- ⚠️ REPLACE 'https://your-project-ref.supabase.co' with your actual Supabase project URL
DO $$
BEGIN
  -- Set the Supabase project URL
  -- Find your project URL in: Supabase Dashboard → Settings → API → Project URL
  PERFORM set_config('app.settings.supabase_url', 'https://your-project-ref.supabase.co', false);
  
  RAISE NOTICE '✅ Triggers recreated successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: Update the project URL in the function above!';
  RAISE NOTICE '    Replace ''https://your-project-ref.supabase.co'' with your actual URL';
  RAISE NOTICE '';
  RAISE NOTICE '    Or set it via:';
  RAISE NOTICE '    ALTER DATABASE postgres SET app.settings.supabase_url = ''https://your-project-ref.supabase.co'';';
END $$;

