-- ============================================
-- Create Resumes Table Migration
-- ============================================
-- Creates the resumes table if it doesn't exist
-- This table stores resume uploads and extracted text

-- Step 1: Create resumes table
CREATE TABLE IF NOT EXISTS public.resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  public_url TEXT,
  extracted_text TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id)
);

-- Step 2: Create index on profile_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_resumes_profile_id ON public.resumes(profile_id);

-- Step 3: Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_resumes_email ON public.resumes(email);

-- Step 4: Enable RLS
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies (drop first if they exist, then create)
-- Users can view their own resumes
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own resumes" ON public.resumes;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view their own resumes"
ON public.resumes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = resumes.profile_id
    AND profiles.email = auth.jwt() ->> 'email'
  )
);

-- Users can insert their own resumes
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can insert their own resumes" ON public.resumes;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can insert their own resumes"
ON public.resumes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = resumes.profile_id
    AND profiles.email = auth.jwt() ->> 'email'
  )
);

-- Users can update their own resumes
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can update their own resumes" ON public.resumes;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can update their own resumes"
ON public.resumes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = resumes.profile_id
    AND profiles.email = auth.jwt() ->> 'email'
  )
);

-- Step 6: Create storage bucket for resumes if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Step 7: Create storage policy for resumes bucket
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can upload their own resumes" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can upload their own resumes"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'resumes' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own resumes (storage)" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view their own resumes (storage)"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'resumes' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Resumes table migration completed successfully!';
  RAISE NOTICE '📊 Table: resumes (with RLS policies)';
  RAISE NOTICE '📊 Storage bucket: resumes (with policies)';
END $$;

