-- Create favorite_companies table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.favorite_companies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    website text,
    linkedin_url text,
    location text,
    reason text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_favorite_companies_user_id ON public.favorite_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_companies_created_at ON public.favorite_companies(created_at);

-- Enable Row Level Security
ALTER TABLE public.favorite_companies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own favorite companies" ON public.favorite_companies
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorite companies" ON public.favorite_companies
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own favorite companies" ON public.favorite_companies
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorite companies" ON public.favorite_companies
    FOR DELETE USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON public.favorite_companies TO authenticated;
GRANT ALL ON public.favorite_companies TO service_role;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS handle_favorite_companies_updated_at ON public.favorite_companies;
CREATE TRIGGER handle_favorite_companies_updated_at
    BEFORE UPDATE ON public.favorite_companies
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Add a unique constraint to prevent duplicate companies per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_favorite_companies_user_name_unique 
ON public.favorite_companies(user_id, lower(name));

COMMENT ON TABLE public.favorite_companies IS 'Table to store user favorite companies for job tracking';
COMMENT ON COLUMN public.favorite_companies.user_id IS 'Reference to the user who added this company';
COMMENT ON COLUMN public.favorite_companies.name IS 'Company name';
COMMENT ON COLUMN public.favorite_companies.website IS 'Company website URL';
COMMENT ON COLUMN public.favorite_companies.linkedin_url IS 'Company LinkedIn profile URL';
COMMENT ON COLUMN public.favorite_companies.location IS 'Preferred job location for this company';
COMMENT ON COLUMN public.favorite_companies.reason IS 'User reason for adding this company to favorites'; 