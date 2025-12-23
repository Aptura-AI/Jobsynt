-- ============================================
-- Migration: Add discount codes system
-- Date: 2025-02-01
-- Purpose: Add discount codes table and profile discount columns
-- ============================================

-- Step 1: Create discount_codes table
CREATE TABLE IF NOT EXISTS public.discount_codes (
  code TEXT PRIMARY KEY,
  discount_percent INTEGER NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  duration_months INTEGER NOT NULL CHECK (duration_months > 0),
  used BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 2: Add discount columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS discount_code TEXT,
ADD COLUMN IF NOT EXISTS discount_percent INTEGER CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)),
ADD COLUMN IF NOT EXISTS discount_end_date DATE;

-- Step 3: Pre-populate discount codes
INSERT INTO public.discount_codes (code, discount_percent, duration_months) VALUES
  -- 1 month codes
  ('1M10', 10, 1),
  ('1M25', 25, 1),
  ('1M50', 50, 1),
  ('1M70', 70, 1),
  -- 2 months codes
  ('2M10', 10, 2),
  ('2M25', 25, 2),
  ('2M50', 50, 2),
  ('2M70', 70, 2),
  -- 3 months codes
  ('3M10', 10, 3),
  ('3M25', 25, 3),
  ('3M50', 50, 3),
  ('3M70', 70, 3)
ON CONFLICT (code) DO NOTHING;

-- Step 4: Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_discount_codes_used ON public.discount_codes(used);
CREATE INDEX IF NOT EXISTS idx_profiles_discount_code ON public.profiles(discount_code);

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed:';
  RAISE NOTICE '   - discount_codes table created';
  RAISE NOTICE '   - discount columns added to profiles';
  RAISE NOTICE '   - 12 discount codes pre-populated';
  RAISE NOTICE '   - Indexes created';
END $$;

