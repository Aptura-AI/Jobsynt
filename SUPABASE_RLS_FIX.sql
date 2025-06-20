-- Fix RLS Policies for Resume Upload
-- Run this in Supabase SQL Editor to fix the resume upload permission issue

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage their own resumes" ON public.resumes;

-- Create more specific RLS policies for resumes table
CREATE POLICY "Users can view their own resumes" ON public.resumes
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own resumes" ON public.resumes
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own resumes" ON public.resumes
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resumes" ON public.resumes
FOR DELETE USING (auth.uid() = user_id);

-- Fix the unique constraint issue for primary resume
-- Drop the existing constraint and recreate it properly
ALTER TABLE public.resumes DROP CONSTRAINT IF EXISTS resumes_user_id_is_primary_key;

-- Create a partial unique index instead (allows multiple false values but only one true per user)
DROP INDEX IF EXISTS idx_resumes_user_primary;
CREATE UNIQUE INDEX idx_resumes_user_primary ON public.resumes (user_id) WHERE is_primary = true;

-- Update storage policies to be more specific
DROP POLICY IF EXISTS "Users can upload their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON storage.objects;

-- Create new storage policies with better path handling
CREATE POLICY "Users can upload their own resumes" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'resumes' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own resumes" ON storage.objects
FOR SELECT USING (
    bucket_id = 'resumes' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own resumes" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'resumes' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own resumes" ON storage.objects
FOR DELETE USING (
    bucket_id = 'resumes' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Success message
SELECT 'Resume RLS policies fixed successfully!' as status; 