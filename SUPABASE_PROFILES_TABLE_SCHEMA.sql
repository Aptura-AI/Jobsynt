-- Supabase Profiles Table Schema
-- This schema matches the dashboard.html form fields exactly

-- Drop existing table if needed (be careful with this in production!)
-- DROP TABLE IF EXISTS profiles CASCADE;

-- Create the profiles table with all required columns
CREATE TABLE IF NOT EXISTS profiles (
    -- Primary identification
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Personal Information
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    linkedin_url TEXT,
    
    -- Location Information
    country VARCHAR(2) DEFAULT 'US', -- ISO country code
    state VARCHAR(100),
    city VARCHAR(100),
    
    -- Visa Information
    visa_status VARCHAR(50),
    visa_expiry DATE,
    
    -- Employment Information
    is_employed BOOLEAN DEFAULT true,
    unemployed_since DATE,
    current_title VARCHAR(200),
    experience_level VARCHAR(20), -- entry, mid, senior, lead
    
    -- Salary Information
    salary_range_from INTEGER,
    salary_range_to INTEGER,
    
    -- Skills and Preferences
    skills TEXT,
    job_types TEXT[], -- PostgreSQL array for multiple selections
    work_modes TEXT[], -- PostgreSQL array for multiple selections
    contract_types TEXT[], -- PostgreSQL array for multiple selections
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(country, state, city);
CREATE INDEX IF NOT EXISTS idx_profiles_visa_status ON profiles(visa_status);

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see and edit their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on profile changes
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Optional: Add some helpful comments
COMMENT ON TABLE profiles IS 'User profiles for job search dashboard';
COMMENT ON COLUMN profiles.job_types IS 'Array of job types: full-time, part-time, contract, internship';
COMMENT ON COLUMN profiles.work_modes IS 'Array of work modes: remote, hybrid, onsite';
COMMENT ON COLUMN profiles.contract_types IS 'Array of contract types: w2-fulltime, w2-contract, c2c, 1099';

-- Sample data validation (optional)
-- ALTER TABLE profiles ADD CONSTRAINT valid_experience_level 
--     CHECK (experience_level IN ('entry', 'mid', 'senior', 'lead'));

-- ALTER TABLE profiles ADD CONSTRAINT valid_country_code 
--     CHECK (country ~ '^[A-Z]{2}$'); 