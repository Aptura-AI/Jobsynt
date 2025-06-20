-- Create favorite_companies table
CREATE TABLE favorite_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    website VARCHAR(500),
    linkedin_url VARCHAR(500),
    location VARCHAR(255),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_favorite_companies_user_id ON favorite_companies(user_id);
CREATE INDEX idx_favorite_companies_created_at ON favorite_companies(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE favorite_companies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own favorite companies" ON favorite_companies
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorite companies" ON favorite_companies
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own favorite companies" ON favorite_companies
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorite companies" ON favorite_companies
    FOR DELETE USING (auth.uid() = user_id);

-- Create applications table if it doesn't exist
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    job_url VARCHAR(500),
    job_description TEXT,
    contact_email VARCHAR(255),
    application_date DATE,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'applied',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for applications
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_application_date ON applications(application_date);

-- Enable RLS for applications
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for applications
DROP POLICY IF EXISTS "Users can view their own applications" ON applications;
CREATE POLICY "Users can view their own applications" ON applications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own applications" ON applications;
CREATE POLICY "Users can insert their own applications" ON applications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own applications" ON applications;
CREATE POLICY "Users can update their own applications" ON applications
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own applications" ON applications;
CREATE POLICY "Users can delete their own applications" ON applications
    FOR DELETE USING (auth.uid() = user_id);

-- Create email_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_provider VARCHAR(50),
    email_address VARCHAR(255),
    read_emails BOOLEAN DEFAULT FALSE,
    send_emails BOOLEAN DEFAULT FALSE,
    auto_followup BOOLEAN DEFAULT FALSE,
    followup_frequency INTEGER DEFAULT 7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes for email_settings
CREATE INDEX IF NOT EXISTS idx_email_settings_user_id ON email_settings(user_id);

-- Enable RLS for email_settings
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email_settings
DROP POLICY IF EXISTS "Users can view their own email settings" ON email_settings;
CREATE POLICY "Users can view their own email settings" ON email_settings
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own email settings" ON email_settings;
CREATE POLICY "Users can insert their own email settings" ON email_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own email settings" ON email_settings;
CREATE POLICY "Users can update their own email settings" ON email_settings
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own email settings" ON email_settings;
CREATE POLICY "Users can delete their own email settings" ON email_settings
    FOR DELETE USING (auth.uid() = user_id); 