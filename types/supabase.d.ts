/**
 * Supabase Database Types
 * 
 * Type definitions for Supabase profiles table Update operations.
 * This ensures TypeScript recognizes visa_status and rate_expectation
 * as valid fields for profile updates.
 */

declare global {
  namespace Supabase {
    interface ProfilesUpdate {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      location?: string | null;
      skills?: string[] | null;
      visa_status?: string | null;
      rate_expectation?: number | null;
      resume_url?: string | null;
      resume_text?: string | null;
      resume_json?: any | null;
    }
  }
}

export {};

