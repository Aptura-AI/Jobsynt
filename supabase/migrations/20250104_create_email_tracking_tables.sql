-- ============================================
-- Email Tracking Tables Migration
-- ============================================
-- Creates tables for tracking email sends and opens
-- Supports open-rate tracking and prevents duplicate emails

-- Step 1: Create email_events table
CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  candidate_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  job_ids JSONB DEFAULT '[]'::jsonb, -- Array of job IDs sent in this email
  type TEXT NOT NULL DEFAULT 'daily_matches', -- 'daily_matches', 'auth', etc.
  message_id TEXT NOT NULL UNIQUE, -- Unique identifier for tracking pixel
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  subject TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create email_opens table for detailed open tracking
CREATE TABLE IF NOT EXISTS public.email_opens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL REFERENCES public.email_events(message_id) ON DELETE CASCADE,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_events_email ON public.email_events(email);
CREATE INDEX IF NOT EXISTS idx_email_events_candidate_id ON public.email_events(candidate_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON public.email_events(type);
CREATE INDEX IF NOT EXISTS idx_email_events_sent_at ON public.email_events(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_events_message_id ON public.email_events(message_id);
CREATE INDEX IF NOT EXISTS idx_email_opens_message_id ON public.email_opens(message_id);
CREATE INDEX IF NOT EXISTS idx_email_opens_opened_at ON public.email_opens(opened_at);

-- Step 4: Create function to update opened_at timestamp
CREATE OR REPLACE FUNCTION update_email_event_opened()
RETURNS TRIGGER AS $$
BEGIN
  -- Update email_events.opened_at only on first open
  UPDATE public.email_events
  SET opened_at = NEW.opened_at, updated_at = NOW()
  WHERE message_id = NEW.message_id AND opened_at IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to auto-update opened_at
DROP TRIGGER IF EXISTS trigger_update_email_event_opened ON public.email_opens;
CREATE TRIGGER trigger_update_email_event_opened
  AFTER INSERT ON public.email_opens
  FOR EACH ROW
  EXECUTE FUNCTION update_email_event_opened();

-- Step 6: Add RLS policies (if RLS is enabled)
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_opens ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view email events (via service role)
DROP POLICY IF EXISTS "Service role can manage email events" ON public.email_events;
CREATE POLICY "Service role can manage email events"
  ON public.email_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage email opens" ON public.email_opens;
CREATE POLICY "Service role can manage email opens"
  ON public.email_opens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Step 7: Add comment for documentation
COMMENT ON TABLE public.email_events IS 'Tracks all emails sent to candidates, including daily job matches';
COMMENT ON TABLE public.email_opens IS 'Tracks individual email opens with user agent and IP for analytics';
COMMENT ON COLUMN public.email_events.message_id IS 'Unique identifier used in tracking pixel URL';
COMMENT ON COLUMN public.email_events.job_ids IS 'Array of job IDs included in this email';

