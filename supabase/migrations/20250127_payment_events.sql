-- ============================================
-- Migration: Payment Events Table
-- Date: 2025-01-27
-- Purpose: Create payment_events table for PayPal payment logging
-- ============================================

-- Create payment_events table
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paypal',
  order_id TEXT NOT NULL UNIQUE,
  payer_email TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on candidate_id for querying payments by candidate
CREATE INDEX IF NOT EXISTS idx_payment_events_candidate_id 
ON public.payment_events(candidate_id);

-- Index on order_id for idempotency checks (already unique, but index helps lookups)
CREATE INDEX IF NOT EXISTS idx_payment_events_order_id 
ON public.payment_events(order_id);

-- Index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_payment_events_created_at 
ON public.payment_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Candidates can view their own payment events
DO $$
BEGIN
  DROP POLICY IF EXISTS "Candidates can view their own payment events" ON public.payment_events;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Candidates can view their own payment events"
ON public.payment_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = payment_events.candidate_id
    AND profiles.email = auth.jwt() ->> 'email'
  )
);

-- RLS Policy: Candidates can insert their own payment events
-- (API route will use service role key, but this allows direct inserts if needed)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Candidates can insert their own payment events" ON public.payment_events;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Candidates can insert their own payment events"
ON public.payment_events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = payment_events.candidate_id
    AND profiles.email = auth.jwt() ->> 'email'
  )
);

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed:';
  RAISE NOTICE '   - payment_events table created';
  RAISE NOTICE '   - Indexes created (candidate_id, order_id, created_at)';
  RAISE NOTICE '   - RLS policies created';
END $$;

