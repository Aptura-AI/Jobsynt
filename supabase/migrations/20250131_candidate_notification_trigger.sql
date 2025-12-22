-- Migration: Add database trigger for candidate registration/completion notifications
-- Date: 2025-01-31
-- Purpose: Send email notifications to info@jobsynt.com when candidates register or complete profiles
-- 
-- REVERSIBLE: To rollback, run:
--   DROP TRIGGER IF EXISTS trigger_notify_candidate_registration ON public.profiles;
--   DROP TRIGGER IF EXISTS trigger_notify_candidate_completion ON public.profiles;
--   DROP FUNCTION IF EXISTS notify_candidate_action();

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS http;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to call Supabase Edge Function
CREATE OR REPLACE FUNCTION notify_candidate_action()
RETURNS TRIGGER AS $$
DECLARE
  action_type TEXT;
  edge_function_url TEXT;
  supabase_url TEXT;
  function_secret TEXT;
  payload JSONB;
  response_status INT;
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

  -- Get Supabase project URL from environment variable
  -- In Supabase, this is typically available via current_setting or we can use a config table
  -- For production, set this via: ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- Fallback: Try to get from Supabase's built-in settings
  IF supabase_url IS NULL OR supabase_url = '' THEN
    -- Try to get from pg_settings or use a default pattern
    -- In production, you should set this via Supabase dashboard or SQL:
    -- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project-ref.supabase.co';
    supabase_url := COALESCE(
      (SELECT setting FROM pg_settings WHERE name = 'app.settings.supabase_url' LIMIT 1),
      'https://your-project-ref.supabase.co'  -- Replace with your actual Supabase project URL
    );
  END IF;

  -- Construct Edge Function URL
  edge_function_url := supabase_url || '/functions/v1/send-candidate-notification';

  -- Get function secret (Supabase anon key or service role key)
  -- Set via: ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key';
  function_secret := current_setting('app.settings.supabase_anon_key', true);
  
  IF function_secret IS NULL OR function_secret = '' THEN
    function_secret := COALESCE(
      (SELECT setting FROM pg_settings WHERE name = 'app.settings.supabase_anon_key' LIMIT 1),
      ''  -- Will use public access if not set
    );
  END IF;

  -- Build payload with all profile data
  payload := jsonb_build_object(
    'profile', to_jsonb(NEW),
    'action', action_type
  );

  -- Call Edge Function via HTTP using pg_net (async, non-blocking)
  -- pg_net.http_post signature: (url text, headers jsonb, body text)
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
      -- If pg_net is not available or fails, log warning but continue
      -- The transaction should not fail if notification fails
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

-- Trigger for new candidate registrations (INSERT)
CREATE TRIGGER trigger_notify_candidate_registration
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.role = 'candidate')
  EXECUTE FUNCTION notify_candidate_action();

-- Trigger for profile completions (UPDATE when onboarding_complete changes to true)
CREATE TRIGGER trigger_notify_candidate_completion
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (
    NEW.role = 'candidate' 
    AND OLD.onboarding_complete = false 
    AND NEW.onboarding_complete = true
  )
  EXECUTE FUNCTION notify_candidate_action();

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed:';
  RAISE NOTICE '   - notify_candidate_action() function created';
  RAISE NOTICE '   - trigger_notify_candidate_registration trigger created';
  RAISE NOTICE '   - trigger_notify_candidate_completion trigger created';
  RAISE NOTICE '';
  RAISE NOTICE '📧 Notifications will be sent to info@jobsynt.com for:';
  RAISE NOTICE '   1. New candidate registrations (INSERT)';
  RAISE NOTICE '   2. Profile completions (onboarding_complete: false → true)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: Configure these settings:';
  RAISE NOTICE '   1. Set Supabase project URL:';
  RAISE NOTICE '      ALTER DATABASE postgres SET app.settings.supabase_url = ''https://your-project-ref.supabase.co'';';
  RAISE NOTICE '   2. Set Supabase anon key (optional, for auth):';
  RAISE NOTICE '      ALTER DATABASE postgres SET app.settings.supabase_anon_key = ''your-anon-key'';';
  RAISE NOTICE '   3. Set ZOHO_PASSWORD in Supabase Edge Function secrets:';
  RAISE NOTICE '      supabase secrets set ZOHO_PASSWORD=your-zoho-password';
END $$;

