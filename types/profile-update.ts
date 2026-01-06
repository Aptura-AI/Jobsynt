/**
 * Profile Update Payload Type
 * 
 * Centralized type definition for Supabase profile updates.
 * Ensures type safety and prevents excess property errors.
 */

export type ProfileUpdatePayload = {
  name?: string;
  email?: string;
  phone?: string | null; // null explicitly clears the field in Supabase
  location?: string;
  skills?: string[];
  visa_status?: string | null; // null explicitly clears the field in Supabase
  rate_expectation?: number;
  resume_url?: string;
  resume_text?: string;
  resume_json?: any;
  title?: string;
  experience_years?: number;
  primary_skills?: string[];
  secondary_skills?: string[];
  adjacent_skills?: string[];
  generic_skills?: string[];
  contract_type?: string;
  work_mode?: string;
  preferred_job_types?: string[];
  preferred_job_type?: string;
  availability?: string;
  summary?: string;
};


