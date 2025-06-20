-- Migration Script for Profiles Table
-- Run this to update your existing profiles table to match the dashboard form

-- Add missing columns (will not fail if columns already exist)
DO $$ 
BEGIN
    -- Personal Information columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'first_name') THEN
        ALTER TABLE profiles ADD COLUMN first_name VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_name') THEN
        ALTER TABLE profiles ADD COLUMN last_name VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
        ALTER TABLE profiles ADD COLUMN phone VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'linkedin_url') THEN
        ALTER TABLE profiles ADD COLUMN linkedin_url TEXT;
    END IF;
    
    -- Location columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'country') THEN
        ALTER TABLE profiles ADD COLUMN country VARCHAR(2) DEFAULT 'US';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'state') THEN
        ALTER TABLE profiles ADD COLUMN state VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'city') THEN
        ALTER TABLE profiles ADD COLUMN city VARCHAR(100);
    END IF;
    
    -- Visa columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'visa_status') THEN
        ALTER TABLE profiles ADD COLUMN visa_status VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'visa_expiry') THEN
        ALTER TABLE profiles ADD COLUMN visa_expiry DATE;
    END IF;
    
    -- Employment columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_employed') THEN
        ALTER TABLE profiles ADD COLUMN is_employed BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'unemployed_since') THEN
        ALTER TABLE profiles ADD COLUMN unemployed_since DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'current_title') THEN
        ALTER TABLE profiles ADD COLUMN current_title VARCHAR(200);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'experience_level') THEN
        ALTER TABLE profiles ADD COLUMN experience_level VARCHAR(20);
    END IF;
    
    -- Salary columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'salary_range_from') THEN
        ALTER TABLE profiles ADD COLUMN salary_range_from INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'salary_range_to') THEN
        ALTER TABLE profiles ADD COLUMN salary_range_to INTEGER;
    END IF;
    
    -- Preferences as arrays
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'job_types') THEN
        ALTER TABLE profiles ADD COLUMN job_types TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'work_modes') THEN
        ALTER TABLE profiles ADD COLUMN work_modes TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'contract_types') THEN
        ALTER TABLE profiles ADD COLUMN contract_types TEXT[];
    END IF;
    
    -- Timestamps
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'created_at') THEN
        ALTER TABLE profiles ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
        ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
END $$;

-- Update data types if they're different
-- Change job_types, work_modes, contract_types from TEXT to TEXT[] if needed
DO $$
BEGIN
    -- Check if job_types is TEXT and convert to TEXT[]
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'job_types' 
        AND data_type = 'text'
        AND is_array = 'NO'
    ) THEN
        -- Convert JSON strings to arrays
        UPDATE profiles 
        SET job_types = CASE 
            WHEN job_types IS NULL OR job_types = '' THEN NULL
            WHEN job_types LIKE '[%]' THEN 
                -- Convert JSON array string to PostgreSQL array
                ARRAY(SELECT json_array_elements_text(job_types::json))
            ELSE 
                -- Single value to array
                ARRAY[job_types]
        END;
        
        -- Change column type
        ALTER TABLE profiles ALTER COLUMN job_types TYPE TEXT[] USING job_types::TEXT[];
    END IF;
    
    -- Same for work_modes
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'work_modes' 
        AND data_type = 'text'
        AND is_array = 'NO'
    ) THEN
        UPDATE profiles 
        SET work_modes = CASE 
            WHEN work_modes IS NULL OR work_modes = '' THEN NULL
            WHEN work_modes LIKE '[%]' THEN 
                ARRAY(SELECT json_array_elements_text(work_modes::json))
            ELSE 
                ARRAY[work_modes]
        END;
        
        ALTER TABLE profiles ALTER COLUMN work_modes TYPE TEXT[] USING work_modes::TEXT[];
    END IF;
    
    -- Same for contract_types
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'contract_types' 
        AND data_type = 'text'
        AND is_array = 'NO'
    ) THEN
        UPDATE profiles 
        SET contract_types = CASE 
            WHEN contract_types IS NULL OR contract_types = '' THEN NULL
            WHEN contract_types LIKE '[%]' THEN 
                ARRAY(SELECT json_array_elements_text(contract_types::json))
            ELSE 
                ARRAY[contract_types]
        END;
        
        ALTER TABLE profiles ALTER COLUMN contract_types TYPE TEXT[] USING contract_types::TEXT[];
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during data type conversion: %', SQLERRM;
END $$;

-- Ensure user_id column exists and is properly set up
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'user_id') THEN
        ALTER TABLE profiles ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'profiles' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name LIKE '%user_id%'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE(user_id);
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(country, state, city);
CREATE INDEX IF NOT EXISTS idx_profiles_visa_status ON profiles(visa_status);

-- Set up RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update existing records to have proper timestamps if they're missing
UPDATE profiles 
SET 
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL OR updated_at IS NULL; 