'use server';

import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Verify admin authentication
 * @returns Admin token or null if not authorized
 */
function verifyAdmin() {
  const cookieStore = cookies();
  const rawToken = cookieStore.get('jobsynth_token')?.value;
  
  if (!rawToken) {
    return null;
  }

  const token = verifyToken(rawToken);
  if (!token || token.role !== 'admin') {
    return null;
  }

  return token;
}

type UpdateCandidateProfileParams = {
  candidateId: string;
  experience?: number;
  location?: string | null;
  primary_skill?: string;
  secondary_skills?: string[];
  additional_skills?: string[];
};

type UpdateResult = {
  success: boolean;
  error?: string;
  message?: string;
};

/**
 * Server action to update candidate profile
 * Admin-only access
 * 
 * @param params - Update parameters
 * @returns Success/error result
 */
export async function updateCandidateProfile(
  params: UpdateCandidateProfileParams
): Promise<UpdateResult> {
  try {
    // Verify admin authentication
    const token = verifyAdmin();
    if (!token) {
      return {
        success: false,
        error: 'Unauthorized - Admin access required'
      };
    }

    // Validate database configuration
    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        success: false,
        error: 'Database not configured'
      };
    }

    // Validate required fields
    if (params.primary_skill !== undefined && (!params.primary_skill || params.primary_skill.trim() === '')) {
      return {
        success: false,
        error: 'Primary skill is required and cannot be empty'
      };
    }

    // Validate skills arrays
    if (params.secondary_skills !== undefined && !Array.isArray(params.secondary_skills)) {
      return {
        success: false,
        error: 'Secondary skills must be an array'
      };
    }

    if (params.secondary_skills !== undefined) {
      const invalidSkills = params.secondary_skills.filter(skill => typeof skill !== 'string');
      if (invalidSkills.length > 0) {
        return {
          success: false,
          error: 'Secondary skills must be an array of strings'
        };
      }
    }

    if (params.additional_skills !== undefined && !Array.isArray(params.additional_skills)) {
      return {
        success: false,
        error: 'Additional skills must be an array'
      };
    }

    if (params.additional_skills !== undefined) {
      const invalidSkills = params.additional_skills.filter(skill => typeof skill !== 'string');
      if (invalidSkills.length > 0) {
        return {
          success: false,
          error: 'Additional skills must be an array of strings'
        };
      }
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if candidate exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, experience_years, location, primary_skills, secondary_skills, adjacent_skills')
      .eq('id', params.candidateId)
      .single();

    if (fetchError || !existingProfile) {
      return {
        success: false,
        error: 'Candidate not found'
      };
    }

    // Build update data - only include fields that were explicitly provided
    const updateData: Record<string, unknown> = {};

    // Experience (experience_years)
    if (params.experience !== undefined) {
      updateData.experience_years = params.experience || null;
    }

    // Location
    if (params.location !== undefined) {
      updateData.location = params.location?.trim() || null;
    }

    // Primary skill - convert to primary_skills array
    if (params.primary_skill !== undefined) {
      updateData.primary_skills = params.primary_skill.trim() 
        ? [params.primary_skill.trim()] 
        : null;
    }

    // Secondary skills
    if (params.secondary_skills !== undefined) {
      const cleanedSkills = params.secondary_skills
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);
      updateData.secondary_skills = cleanedSkills.length > 0 ? cleanedSkills : null;
    }

    // Additional skills - map to adjacent_skills
    if (params.additional_skills !== undefined) {
      const cleanedSkills = params.additional_skills
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);
      updateData.adjacent_skills = cleanedSkills.length > 0 ? cleanedSkills : null;
    }

    // If no fields to update, return success (no-op)
    if (Object.keys(updateData).length === 0) {
      return {
        success: true,
        message: 'No changes to save'
      };
    }

    // Update profile
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', params.candidateId)
      .select('id, experience_years, location, primary_skills, secondary_skills, adjacent_skills')
      .single();

    if (updateError) {
      console.error('[Admin] Error updating candidate profile:', updateError);
      return {
        success: false,
        error: updateError.message || 'Failed to update profile'
      };
    }

    return {
      success: true,
      message: 'Profile updated successfully'
    };
  } catch (error: unknown) {
    console.error('[Admin] Error updating candidate profile:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return {
      success: false,
      error: errorMessage
    };
  }
}
