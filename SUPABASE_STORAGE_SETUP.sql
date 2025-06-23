-- Create storage buckets for resumes and cover letters
-- Run these commands in your Supabase SQL editor

-- Create resumes bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false);

-- Create cover-letters bucket  
INSERT INTO storage.buckets (id, name, public)
VALUES ('cover-letters', 'cover-letters', true);

-- Set up RLS policies for resumes bucket (private)
CREATE POLICY "Users can upload their own resumes" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own resumes" ON storage.objects
FOR SELECT USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own resumes" ON storage.objects
FOR UPDATE USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own resumes" ON storage.objects
FOR DELETE USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Set up RLS policies for cover-letters bucket (public for downloads)
CREATE POLICY "Users can upload their own cover letters" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'cover-letters' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view cover letters" ON storage.objects
FOR SELECT USING (bucket_id = 'cover-letters');

CREATE POLICY "Users can update their own cover letters" ON storage.objects
FOR UPDATE USING (bucket_id = 'cover-letters' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own cover letters" ON storage.objects
FOR DELETE USING (bucket_id = 'cover-letters' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; 