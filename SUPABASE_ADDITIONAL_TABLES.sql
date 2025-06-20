-- Additional Tables for Jobsynt Dashboard
-- Run this script in Supabase SQL Editor after the profiles table is created

-- 1. Resumes table for storing resume information
CREATE TABLE IF NOT EXISTS public.resumes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size bigint NOT NULL,
    file_type text NOT NULL,
    is_primary boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Constraints
    UNIQUE(user_id, is_primary) DEFERRABLE INITIALLY DEFERRED -- Only one primary resume per user
);

-- 2. Companies table for storing company information
CREATE TABLE IF NOT EXISTS public.companies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    website text,
    linkedin_url text,
    headquarters text,
    industry text,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Constraints
    UNIQUE(name, website) -- Prevent duplicate companies
);

-- 3. User-Company relationship table (for favorite companies)
CREATE TABLE IF NOT EXISTS public.user_companies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    preferred_location text,
    reason text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Constraints
    UNIQUE(user_id, company_id) -- Prevent duplicate favorites
);

-- 4. Job Applications table for tracking applications
CREATE TABLE IF NOT EXISTS public.job_applications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    job_title text NOT NULL,
    job_url text,
    job_description text,
    status text DEFAULT 'applied' CHECK (status IN ('applied', 'interviewed', 'rejected', 'offer', 'withdrawn')),
    application_date date DEFAULT CURRENT_DATE,
    salary_offered numeric,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 5. Job Alerts table for user preferences
CREATE TABLE IF NOT EXISTS public.job_alerts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_name text NOT NULL,
    keywords text[],
    job_types text[],
    work_modes text[],
    salary_min numeric,
    salary_max numeric,
    locations text[],
    frequency text DEFAULT 'daily' CHECK (frequency IN ('instant', 'daily', 'weekly')),
    is_active boolean DEFAULT true,
    last_sent timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 6. Networking Contacts table
CREATE TABLE IF NOT EXISTS public.networking_contacts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    name text NOT NULL,
    position text,
    email text,
    linkedin_url text,
    phone text,
    notes text,
    contact_status text DEFAULT 'not_contacted' CHECK (contact_status IN ('not_contacted', 'contacted', 'responded', 'meeting_scheduled', 'no_response')),
    last_contacted timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 7. Create the resumes storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes', 'resumes', false) 
ON CONFLICT (id) DO NOTHING;

-- 8. Storage policies for resumes bucket
CREATE POLICY "Users can upload their own resumes" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'resumes' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own resumes" ON storage.objects
FOR SELECT USING (
    bucket_id = 'resumes' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own resumes" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'resumes' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own resumes" ON storage.objects
FOR DELETE USING (
    bucket_id = 'resumes' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- 9. Row Level Security (RLS) policies for all tables

-- Resumes RLS
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own resumes" ON public.resumes
FOR ALL USING (auth.uid() = user_id);

-- Companies RLS (read-only for all authenticated users, insert/update for system)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view companies" ON public.companies
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert companies" ON public.companies
FOR INSERT TO authenticated WITH CHECK (true);

-- User Companies RLS
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their favorite companies" ON public.user_companies
FOR ALL USING (auth.uid() = user_id);

-- Job Applications RLS
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own applications" ON public.job_applications
FOR ALL USING (auth.uid() = user_id);

-- Job Alerts RLS
ALTER TABLE public.job_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own alerts" ON public.job_alerts
FOR ALL USING (auth.uid() = user_id);

-- Networking Contacts RLS
ALTER TABLE public.networking_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own contacts" ON public.networking_contacts
FOR ALL USING (auth.uid() = user_id);

-- 10. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_user_id ON public.user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company_id ON public.user_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON public.job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_alerts_user_id ON public.job_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_networking_contacts_user_id ON public.networking_contacts(user_id);

-- 11. Create updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to all tables
CREATE TRIGGER set_resumes_updated_at
    BEFORE UPDATE ON public.resumes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_user_companies_updated_at
    BEFORE UPDATE ON public.user_companies
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_job_applications_updated_at
    BEFORE UPDATE ON public.job_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_job_alerts_updated_at
    BEFORE UPDATE ON public.job_alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_networking_contacts_updated_at
    BEFORE UPDATE ON public.networking_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.resumes TO authenticated;
GRANT ALL ON public.companies TO authenticated;
GRANT ALL ON public.user_companies TO authenticated;
GRANT ALL ON public.job_applications TO authenticated;
GRANT ALL ON public.job_alerts TO authenticated;
GRANT ALL ON public.networking_contacts TO authenticated;

-- Success message
SELECT 'All additional tables created successfully!' as status; 