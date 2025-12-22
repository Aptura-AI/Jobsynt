-- Migration: Backfill 7-day free trials for existing unpaid candidates
-- Date: 2025-12-22
-- Purpose: Set trial_ends_at = 2025-12-29T23:59:59 for all existing unpaid candidates
--          who registered on or before 2025-12-22

-- ROLLBACK (if needed):
--   UPDATE public.profiles
--   SET trial_ends_at = NULL
--   WHERE trial_ends_at = '2025-12-29T23:59:59+00:00'::timestamptz
--     AND is_paid = false
--     AND role = 'candidate';

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Backfill trial_ends_at for all unpaid candidates who don't have a trial yet
  -- Only update if:
  --   1. trial_ends_at IS NULL (no existing trial)
  --   2. is_paid IS NOT TRUE (not paid)
  --   3. role = 'candidate' (only candidates, not admins/recruiters)
  -- Set trial_ends_at to 2025-12-29T23:59:59 (7 days from 2025-12-22)
  
  UPDATE public.profiles
  SET trial_ends_at = '2025-12-29T23:59:59+00:00'::timESTAMPTZ
  WHERE trial_ends_at IS NULL
    AND (is_paid IS NULL OR is_paid = false)
    AND role = 'candidate';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE NOTICE '✅ Backfilled % candidate profiles with trial ending 2025-12-29', updated_count;
END $$;

-- Verify the backfill
DO $$
DECLARE
  total_candidates INTEGER;
  trials_set INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_candidates
  FROM public.profiles
  WHERE role = 'candidate' AND (is_paid IS NULL OR is_paid = false);
  
  SELECT COUNT(*) INTO trials_set
  FROM public.profiles
  WHERE role = 'candidate'
    AND (is_paid IS NULL OR is_paid = false)
    AND trial_ends_at IS NOT NULL;
  
  RAISE NOTICE '📊 Verification: % unpaid candidates, % have trials set', total_candidates, trials_set;
END $$;

