-- Simple Migration for Profiles Table
-- Run this step by step in Supabase SQL Editor

-- Step 1: Check current table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- Step 2: Drop existing table and recreate (ONLY if you don't have important data)
-- WARNING: This will delete all existing data!
-- Uncomment the lines below ONLY if you want to start fresh:

-- DROP TABLE IF EXISTS profiles CASCADE;

-- Step 3: Create the complete profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Personal Info
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    linkedin_url TEXT,
    
    -- Location
    country VARCHAR(2) DEFAULT 'US',
    state VARCHAR(100),
    city VARCHAR(100),
    
    -- Visa
    visa_status VARCHAR(50),
    visa_expiry DATE,
    
    -- Employment
    is_employed BOOLEAN DEFAULT true,
    unemployed_since DATE,
    current_title VARCHAR(200),
    experience_level VARCHAR(20),
    
    -- Salary
    salary_range_from INTEGER,
    salary_range_to INTEGER,
    
    -- Skills
    skills TEXT,
    
    -- Arrays (this is the key fix!)
    job_types TEXT[],
    work_modes TEXT[],
    contract_types TEXT[],
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Step 4: Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
DROP POLICY IF EXISTS "Enable all operations for users based on user_id" ON profiles;
CREATE POLICY "Enable all operations for users based on user_id" ON profiles
    FOR ALL USING (auth.uid() = user_id);

-- Step 6: Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Step 7: Create update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Test the table
INSERT INTO profiles (
    user_id, 
    email, 
    first_name, 
    last_name,
    job_types,
    work_modes,
    contract_types
) VALUES (
    auth.uid(),
    'test@example.com',
    'Test',
    'User',
    ARRAY['full-time'],
    ARRAY['remote'],
    ARRAY['w2-fulltime']
) ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    job_types = EXCLUDED.job_types,
    work_modes = EXCLUDED.work_modes,
    contract_types = EXCLUDED.contract_types,
    updated_at = NOW();

-- Step 9: Verify the insert worked
SELECT * FROM profiles WHERE user_id = auth.uid(); 