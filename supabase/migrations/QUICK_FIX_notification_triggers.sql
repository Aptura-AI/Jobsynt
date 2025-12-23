-- QUICK FIX: Drop and recreate notification triggers with correct URL
-- Run this in Supabase SQL Editor

-- Step 1: Drop existing triggers
DROP TRIGGER IF EXISTS trigger_notify_candidate_registration ON public.profiles;
DROP TRIGGER IF EXISTS trigger_notify_candidate_completion ON public.profiles;

-- Step 2: Drop existing function
DROP FUNCTION IF EXISTS notify_candidate_action();

-- Step 3: Set your Supabase project URL
-- ⚠️ REPLACE 'https://your-project-ref.supabase.co' with your actual URL
-- Find it in: Supabase Dashboard → Settings → API → Project URL
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project-ref.supabase.co';

-- Step 4: (Optional) Set anon key for Edge Function auth
-- ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key-here';

-- Step 5: Recreate function (it will use the URL from Step 3)
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
    IF OLD.onboarding_complete = false AND NEW.onboarding_complete = true THEN
      action_type := 'completion';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Get Supabase project URL from database setting
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE WARNING 'Supabase URL not configured! Set it with: ALTER DATABASE postgres SET app.settings.supabase_url = ''your-url'';';
    RETURN NEW;
  END IF;

  edge_function_url := supabase_url || '/functions/v1/send-candidate-notification';
  function_secret := current_setting('app.settings.supabase_anon_key', true);

  payload := jsonb_build_object(
    'profile', to_jsonb(NEW),
    'action', action_type
  );

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
      RAISE WARNING 'Error calling notification function: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in notify_candidate_action: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Recreate triggers
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

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✅ Triggers recreated successfully!';
  RAISE NOTICE '📧 Notifications will be sent to info@jobsynt.com';
END $$;

