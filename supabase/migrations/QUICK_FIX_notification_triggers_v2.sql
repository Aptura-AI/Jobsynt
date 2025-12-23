-- QUICK FIX v2: Drop and recreate notification triggers (no superuser permissions needed)
-- Run this in Supabase SQL Editor
-- ⚠️ IMPORTANT: Replace 'https://your-project-ref.supabase.co' with your actual Supabase project URL on line 47

-- Step 1: Drop existing triggers
DROP TRIGGER IF EXISTS trigger_notify_candidate_registration ON public.profiles;
DROP TRIGGER IF EXISTS trigger_notify_candidate_completion ON public.profiles;

-- Step 2: Drop existing function
DROP FUNCTION IF EXISTS notify_candidate_action();

-- Step 3: Create a simple config table to store the Supabase URL (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Insert or update the Supabase project URL
-- ⚠️ REPLACE 'https://your-project-ref.supabase.co' with your actual Supabase project URL
-- Find it in: Supabase Dashboard → Settings → API → Project URL
INSERT INTO public.app_config (key, value)
VALUES ('supabase_url', 'https://yhrwamhdiiggsapmfwas.supabase.co')
ON CONFLICT (key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Step 5: (Optional) Insert anon key if you want to use it
INSERT INTO public.app_config (key, value)
VALUES ('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocndhbWhkaWlnZ3NhcG1md2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMDI1ODIsImV4cCI6MjA2MDU3ODU4Mn0.K8nMLX_MTR2IlfIaviyfex8fWuZ1qL07Gg_xIG3TYsE')
ON CONFLICT (key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Step 6: Grant access to the config table (if needed)
GRANT SELECT ON public.app_config TO authenticated;
GRANT SELECT ON public.app_config TO anon;

-- Step 7: Recreate function (reads URL from config table)
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

  -- Get Supabase project URL from config table
  SELECT value INTO supabase_url
  FROM public.app_config
  WHERE key = 'supabase_url'
  LIMIT 1;
  
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE WARNING 'Supabase URL not configured in app_config table! Please run the INSERT statement above.';
    RETURN NEW;
  END IF;

  -- Construct Edge Function URL
  edge_function_url := supabase_url || '/functions/v1/send-candidate-notification';
  
  -- Get function secret (optional, from config table)
  SELECT value INTO function_secret
  FROM public.app_config
  WHERE key = 'supabase_anon_key'
  LIMIT 1;

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
      RAISE WARNING 'Error calling notification function: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in notify_candidate_action: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Recreate triggers
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
DECLARE
  configured_url TEXT;
BEGIN
  SELECT value INTO configured_url
  FROM public.app_config
  WHERE key = 'supabase_url';
  
  IF configured_url IS NULL THEN
    RAISE NOTICE '⚠️  WARNING: Supabase URL not configured!';
    RAISE NOTICE '   Please update line 17 with your actual project URL and run the INSERT statement.';
  ELSE
    RAISE NOTICE '✅ Triggers recreated successfully!';
    RAISE NOTICE '📧 Notifications will be sent to info@jobsynt.com';
    RAISE NOTICE '🔗 Using project URL: %', configured_url;
  END IF;
END $$;

