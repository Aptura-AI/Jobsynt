/**
 * Centralized Post-Auth Routing Logic
 * 
 * This module determines where users should be redirected after authentication
 * based on their role, onboarding status, and account type.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export type UserRole = 'admin' | 'candidate' | 'company';

export interface UserOnboardingStatus {
  isFirstTime: boolean;
  onboardingComplete: boolean;
  role: UserRole;
  email: string;
}

/**
 * Profile type for database queries
 * All fields that might be accessed must be included
 */
interface ProfileRow {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  image_url: string | null;
  role: UserRole | null;
  onboarding_complete: boolean | null;
}

/**
 * Gets Supabase admin client (with service role key)
 */
function getSupabaseAdminClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Supabase admin client not configured');
    }
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Determines if a user is an admin
 * SINGLE SOURCE OF TRUTH: Only checks profiles.role === 'admin'
 * Email hardcoding is NOT used for runtime checks
 */
export function isAdminUser(role: string | undefined | null): boolean {
  return role === 'admin';
}

/**
 * Fetches user onboarding status from Supabase
 * SINGLE SOURCE OF TRUTH: Reads role from profiles.role column
 */
export async function getUserOnboardingStatus(
  email: string,
  userId?: string
): Promise<UserOnboardingStatus> {
  const supabase = getSupabaseAdminClient();
  
  if (!supabase) {
    // Fallback: assume first-time candidate if we can't check
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Cannot fetch user status - Supabase not configured');
    }
    return {
      isFirstTime: true,
      onboardingComplete: false,
      role: 'candidate',
      email,
    };
  }

  // Try to find profile by user_id (preferred) or email
  let query = supabase.from('profiles').select('onboarding_complete, role, email, user_id');
  
  if (userId) {
    query = query.eq('user_id', userId);
  } else {
    query = query.eq('email', email.toLowerCase());
  }

  const { data: profile, error } = await query.maybeSingle();

  if (error || !profile) {
    // No profile found = first-time user (default to candidate)
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 No profile found for ${email} - treating as first-time candidate`);
    }
    return {
      isFirstTime: true,
      onboardingComplete: false,
      role: 'candidate', // Default role, never assume admin
      email,
    };
  }

  const onboardingComplete = profile.onboarding_complete === true;
  // SINGLE SOURCE OF TRUTH: role comes ONLY from database
  const role = (profile.role as UserRole) || 'candidate';

  if (process.env.NODE_ENV === 'development') {
    console.log(`📊 User status: ${email} → role=${role}, onboarding_complete=${onboardingComplete}`);
  }

  return {
    isFirstTime: !onboardingComplete,
    onboardingComplete,
    role,
    email: profile.email || email,
  };
}

/**
 * Determines the post-auth redirect URL based on user status
 * 
 * EXACT ROUTING RULES:
 * 1. IF role === 'admin' → /admin (always, no exceptions)
 * 2. ELSE IF onboarding_complete === false → /candidates
 * 3. ELSE → /dashboard
 */
export async function getPostAuthRedirect(
  email: string,
  userId?: string,
  requestedPath?: string
): Promise<string> {
  const status = await getUserOnboardingStatus(email, userId);

  // Enhanced logging for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('[AUTH REDIRECT]', { 
      email, 
      role: status.role, 
      onboarding_complete: status.onboardingComplete,
      isFirstTime: status.isFirstTime 
    });
  }

  // Rule 1: Admin users ALWAYS go to /admin (no exceptions)
  if (status.role === 'admin') {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔀 Redirect decision: ${email} (admin) → /admin`);
    }
    return '/admin';
  }

  // Rule 2: Company users go to company dashboard
  if (status.role === 'company') {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔀 Redirect decision: ${email} (company) → /company`);
    }
    return '/company';
  }

  // Rule 3: First-time users (onboarding_complete === false) → /candidates
  if (!status.onboardingComplete) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔀 Redirect decision: ${email} (onboarding incomplete) → /candidates`);
    }
    return '/candidates';
  }

  // Rule 4: Returning candidates → /dashboard
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔀 Redirect decision: ${email} (onboarding complete) → /dashboard`);
  }
  return '/dashboard';
}

/**
 * Creates or updates a profile in Supabase after OAuth signup
 * Ensures profile exists with correct defaults:
 * - role defaults to 'candidate' (unless already set in DB)
 * - onboarding_complete defaults to false
 * - Admin role is determined from database, not email
 * 
 * HARDENED: Full type safety, defensive checks, handles all edge cases
 */
export async function ensureProfileExists(
  userId: string,
  email: string,
  name?: string,
  image?: string
): Promise<ProfileRow | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Cannot ensure profile - Supabase not configured');
    }
    return null;
  }

  // Validate inputs
  if (!userId || !email) {
    console.error('ensureProfileExists: userId and email are required');
    return null;
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    console.error('ensureProfileExists: Invalid email format');
    return null;
  }

  // Check if profile exists by user_id (preferred) or email
  // Select ALL fields we might need to avoid TypeScript errors
  const { data: existing, error: fetchError } = await supabase
    .from('profiles')
    .select('id, user_id, email, name, image_url, role, onboarding_complete')
    .or(`user_id.eq.${userId},email.eq.${normalizedEmail}`)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 means no rows found, which is expected for new users
    console.error('Error fetching profile:', fetchError);
    return null;
  }

  // Type guard: existing is properly typed as ProfileRow | null
  // Supabase returns the selected fields, so we can safely type it
  const existingProfile: ProfileRow | null = (existing as ProfileRow | null) || null;

  if (!existingProfile) {
    // Create new profile with safe defaults
    // For new signups, default to 'candidate' - admin must be set via migration/backfill
    // Check if this email is the admin email (but don't hardcode role check)
    const isAdminEmail = normalizedEmail === 'info@jobsynt.com';
    
    // Verify admin exists in DB before assigning admin role
    let role: UserRole = 'candidate';
    if (isAdminEmail) {
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('email', 'info@jobsynt.com')
        .eq('role', 'admin')
        .maybeSingle();
      
      // Only set admin if admin profile already exists in DB
      if (adminProfile && (adminProfile as { role: string }).role === 'admin') {
        role = 'admin';
      }
    }
    
    const onboardingComplete = role === 'admin'; // Admin skips onboarding

    // Auto-start 7-day free trial for new candidate profiles
    // Only set trial_ends_at if: role is candidate AND trial_ends_at is NULL AND is_paid is false
    // Guardrails: Never overwrite existing trial_ends_at, never overwrite is_paid = true
    const isCandidate = role === 'candidate';
    const trialEndDate = isCandidate 
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const newProfile: Partial<ProfileRow> = {
      user_id: userId,
      email: normalizedEmail,
      name: name?.trim() || normalizedEmail.split('@')[0],
      image_url: image?.trim() || null,
      role,
      onboarding_complete: onboardingComplete,
      // Set trial_ends_at only for new candidate profiles
      ...(trialEndDate && { 
        trial_ends_at: trialEndDate,
        is_paid: false, // Explicitly set is_paid = false for new trials
        paid_at: null, // Explicitly set paid_at = null for new trials
      }),
    };

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .insert(newProfile)
      .select('id, user_id, email, name, image_url, role, onboarding_complete')
      .single();

    if (insertError) {
      console.error('Error creating profile:', insertError);
      return null;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Created profile for ${normalizedEmail} with role=${role}`);
      if (trialEndDate) {
        console.log(`[Profile Creation] Starting 7-day free trial for ${normalizedEmail}, ends at ${trialEndDate}`);
      }
    }

    return (inserted as ProfileRow | null);
  } else {
    // Update existing profile - link user_id if missing, preserve role from DB
    const updateData: Partial<ProfileRow> = {
      email: normalizedEmail,
    };

    // Only update fields that are provided and different
    if (name && name.trim() !== existingProfile.name) {
      updateData.name = name.trim();
    }
    if (image && image.trim() !== existingProfile.image_url) {
      updateData.image_url = image.trim();
    }
    if (!existingProfile.user_id) {
      updateData.user_id = userId;
    }
    // DO NOT override role or onboarding_complete - they come from database only

    // Only update if there are changes
    if (Object.keys(updateData).length > 1) { // More than just email
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', existingProfile.id)
        .select('id, user_id, email, name, image_url, role, onboarding_complete')
        .single();

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return existingProfile; // Return existing on error
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Updated profile for ${normalizedEmail} (preserved role=${updated?.role || existingProfile.role})`);
      }

      return (updated as ProfileRow | null) || existingProfile;
    }

    // No changes needed
    if (process.env.NODE_ENV === 'development') {
      console.log(`ℹ️  Profile for ${normalizedEmail} already exists (no updates needed)`);
    }

    return existingProfile;
  }
}

