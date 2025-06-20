-- Background Job Scraping System for Jobsynt
-- This system continuously scrapes jobs, filters through AI, and stores them for each user profile

-- 1. Scraped Jobs Storage (Raw data from scrapers)
CREATE TABLE IF NOT EXISTS public.scraped_jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id text UNIQUE NOT NULL, -- External job ID from source
    title text NOT NULL,
    company text NOT NULL,
    location text,
    salary text,
    job_type text, -- full-time, part-time, contract
    work_mode text, -- remote, hybrid, onsite
    description text,
    requirements text,
    url text,
    source text NOT NULL, -- indeed, linkedin, glassdoor, etc.
    posted_date timestamptz,
    scraped_at timestamptz DEFAULT now(),
    is_active boolean DEFAULT true,
    
    -- AI Analysis Fields
    ghost_score integer DEFAULT 0,
    is_ghost_job boolean DEFAULT false,
    ghost_flags text[],
    gpt_analysis_done boolean DEFAULT false,
    gpt_quality_score integer DEFAULT 0,
    gpt_analysis text,
    
    -- Skills and Keywords
    extracted_skills text[],
    keywords text[],
    experience_level text, -- entry, mid, senior, executive
    
    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Profile-Matched Jobs (Jobs matched to specific user profiles)
CREATE TABLE IF NOT EXISTS public.profile_matched_jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scraped_job_id uuid NOT NULL REFERENCES public.scraped_jobs(id) ON DELETE CASCADE,
    
    -- Matching Scores
    profile_match_score integer NOT NULL, -- 0-100
    skill_match_score integer DEFAULT 0,
    location_match_score integer DEFAULT 0,
    salary_match_score integer DEFAULT 0,
    experience_match_score integer DEFAULT 0,
    
    -- GPT Analysis for this specific profile
    gpt_match_analysis text,
    gpt_strengths text[],
    gpt_concerns text[],
    gpt_recommendation text,
    
    -- Status
    is_recommended boolean DEFAULT false, -- Top 20% or 50 daily limit
    shown_to_user boolean DEFAULT false,
    user_interested boolean, -- null = not shown, true = interested, false = not interested
    applied boolean DEFAULT false,
    applied_at timestamptz,
    
    -- Timing
    matched_at timestamptz DEFAULT now(),
    last_updated timestamptz DEFAULT now(),
    
    -- Constraints
    UNIQUE(user_id, scraped_job_id) -- Prevent duplicate matches
);

-- 3. Daily Job Recommendations (Top picks for each user)
CREATE TABLE IF NOT EXISTS public.daily_job_recommendations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_matched_job_id uuid NOT NULL REFERENCES public.profile_matched_jobs(id) ON DELETE CASCADE,
    
    -- Daily tracking
    recommendation_date date DEFAULT CURRENT_DATE,
    rank_position integer NOT NULL, -- 1-50 (daily limit)
    
    -- Status tracking
    is_active boolean DEFAULT true,
    replaced_by uuid REFERENCES public.daily_job_recommendations(id),
    replacement_reason text,
    
    created_at timestamptz DEFAULT now(),
    
    -- Constraints
    UNIQUE(user_id, recommendation_date, rank_position),
    UNIQUE(user_id, profile_matched_job_id, recommendation_date)
);

-- 4. Background Scraping Status
CREATE TABLE IF NOT EXISTS public.scraping_status (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    source text NOT NULL, -- indeed, linkedin, etc.
    last_scrape_start timestamptz,
    last_scrape_end timestamptz,
    last_success timestamptz,
    jobs_scraped_count integer DEFAULT 0,
    jobs_processed_count integer DEFAULT 0,
    error_message text,
    is_active boolean DEFAULT true,
    next_scheduled_scrape timestamptz,
    
    -- Configuration
    scrape_frequency_minutes integer DEFAULT 60, -- How often to scrape
    max_jobs_per_scrape integer DEFAULT 100,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(source)
);

-- 5. User Job Preferences (Enhanced profile matching)
CREATE TABLE IF NOT EXISTS public.user_job_preferences (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Preferences
    preferred_job_types text[], -- full-time, part-time, contract
    preferred_work_modes text[], -- remote, hybrid, onsite
    preferred_locations text[],
    salary_min integer,
    salary_max integer,
    excluded_companies text[],
    must_have_skills text[],
    nice_to_have_skills text[],
    
    -- Notification preferences
    email_notifications boolean DEFAULT true,
    notification_frequency text DEFAULT 'daily', -- daily, weekly, instant
    max_daily_recommendations integer DEFAULT 5,
    
    -- AI preferences
    min_match_score integer DEFAULT 70,
    include_remote_jobs boolean DEFAULT true,
    include_visa_sponsored boolean,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(user_id)
);

-- 6. Job Application Tracking (Separate from recommendations)
CREATE TABLE IF NOT EXISTS public.job_applications_tracking (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_matched_job_id uuid REFERENCES public.profile_matched_jobs(id),
    
    -- Application details
    application_method text, -- through_platform, direct, email
    application_url text,
    cover_letter_used text,
    resume_version text,
    
    -- Tracking
    applied_at timestamptz DEFAULT now(),
    status text DEFAULT 'applied', -- applied, viewed, rejected, interview, offer
    status_updated_at timestamptz DEFAULT now(),
    
    -- Follow-up
    follow_up_scheduled timestamptz,
    follow_up_completed timestamptz,
    notes text,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 7. Notification Queue
CREATE TABLE IF NOT EXISTS public.notification_queue (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL, -- new_jobs, daily_digest, application_update
    title text NOT NULL,
    message text NOT NULL,
    data jsonb, -- Additional data for the notification
    
    -- Delivery
    scheduled_for timestamptz DEFAULT now(),
    sent_at timestamptz,
    delivery_method text DEFAULT 'email', -- email, in_app, sms
    is_sent boolean DEFAULT false,
    error_message text,
    
    created_at timestamptz DEFAULT now()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_source_active ON public.scraped_jobs(source, is_active);
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_scraped_at ON public.scraped_jobs(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_ghost_score ON public.scraped_jobs(ghost_score) WHERE is_ghost_job = false;

CREATE INDEX IF NOT EXISTS idx_profile_matched_jobs_user_id ON public.profile_matched_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_matched_jobs_match_score ON public.profile_matched_jobs(profile_match_score DESC);
CREATE INDEX IF NOT EXISTS idx_profile_matched_jobs_recommended ON public.profile_matched_jobs(is_recommended) WHERE is_recommended = true;

CREATE INDEX IF NOT EXISTS idx_daily_recommendations_user_date ON public.daily_job_recommendations(user_id, recommendation_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_recommendations_active ON public.daily_job_recommendations(user_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled ON public.notification_queue(scheduled_for) WHERE is_sent = false;

-- Row Level Security (RLS)
ALTER TABLE public.scraped_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_matched_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_job_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_job_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin can manage scraped jobs" ON public.scraped_jobs
FOR ALL TO authenticated 
USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can view their matched jobs" ON public.profile_matched_jobs
FOR SELECT TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their recommendations" ON public.daily_job_recommendations
FOR SELECT TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their job preferences" ON public.user_job_preferences
FOR ALL TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their applications" ON public.job_applications_tracking
FOR ALL TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their notifications" ON public.notification_queue
FOR SELECT TO authenticated 
USING (auth.uid() = user_id);

-- Functions and Triggers

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers
CREATE TRIGGER update_scraped_jobs_updated_at BEFORE UPDATE ON public.scraped_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profile_matched_jobs_updated_at BEFORE UPDATE ON public.profile_matched_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_job_preferences_updated_at BEFORE UPDATE ON public.user_job_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_applications_tracking_updated_at BEFORE UPDATE ON public.job_applications_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scraping_status_updated_at BEFORE UPDATE ON public.scraping_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initialize scraping status for common sources
INSERT INTO public.scraping_status (source, scrape_frequency_minutes, max_jobs_per_scrape) 
VALUES 
    ('indeed', 60, 100),
    ('linkedin', 90, 50),
    ('glassdoor', 120, 75),
    ('ziprecruiter', 60, 100),
    ('monster', 180, 50),
    ('dice', 120, 50),
    ('angel', 240, 25),
    ('remoteco', 180, 30)
ON CONFLICT (source) DO NOTHING;

-- Grant permissions
GRANT SELECT ON public.scraped_jobs TO authenticated;
GRANT ALL ON public.profile_matched_jobs TO authenticated;
GRANT ALL ON public.daily_job_recommendations TO authenticated;
GRANT ALL ON public.user_job_preferences TO authenticated;
GRANT ALL ON public.job_applications_tracking TO authenticated;
GRANT SELECT ON public.notification_queue TO authenticated;
GRANT SELECT ON public.scraping_status TO authenticated;

SELECT 'Background job scraping system tables created successfully!' as status; 