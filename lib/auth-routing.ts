/**
 * Centralized Post-Auth Routing Logic
 * 
 * This module determines where users should be redirected after authentication
 * based on their role, onboarding status, and account type.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

export type UserRole = 'admin' | 'candidate' | 'company';

export interface UserOnboardingStatus {
  isFirstTime: boolean;
  onboardingComplete: boolean;
  role: UserRole;
  email: string;
}

/**
 * Determines if a user is an admin
 */
export function isAdminUser(email: string, role?: string): boolean {
  return email.toLowerCase() === 'info@jobsynt.com' || role === 'admin';
}

/**
 * Fetches user onboarding status from Supabase
 */
export async function getUserOnboardingStatus(
  email: string,
  userId?: string
): Promise<UserOnboardingStatus> {
  if (!supabaseUrl || !supabaseServiceKey) {
    // Fallback: assume first-time if we can't check
    return {
      isFirstTime: true,
      onboardingComplete: false,
      role: 'candidate',
      email,
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Try to find profile by email or user_id
  let query = supabase.from('profiles').select('onboarding_complete, role, email, user_id');
  
  if (userId) {
    query = query.eq('user_id', userId);
  } else {
    query = query.eq('email', email.toLowerCase());
  }

  const { data: profile, error } = await query.maybeSingle();

  if (error || !profile) {
    // No profile found = first-time user
    return {
      isFirstTime: true,
      onboardingComplete: false,
      role: isAdminUser(email) ? 'admin' : 'candidate',
      email,
    };
  }

  const onboardingComplete = profile.onboarding_complete === true;
  const role = (profile.role as UserRole) || (isAdminUser(email) ? 'admin' : 'candidate');

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
 * Routing Rules:
 * 1. Admin users → /admin (or /dashboard if admin dashboard)
 * 2. First-time candidates → /candidates (onboarding)
 * 3. Returning candidates → /dashboard (or /candidate-dashboard)
 * 4. Companies → /company
 */
export async function getPostAuthRedirect(
  email: string,
  userId?: string,
  requestedPath?: string
): Promise<string> {
  const status = await getUserOnboardingStatus(email, userId);

  // Admin users always go to admin dashboard
  if (status.role === 'admin' || isAdminUser(email)) {
    return '/admin';
  }

  // Company users go to company dashboard
  if (status.role === 'company') {
    return '/company';
  }

  // First-time candidates must complete onboarding
  if (status.isFirstTime || !status.onboardingComplete) {
    return '/candidates';
  }

  // Returning candidates go to their dashboard
  return '/dashboard';
}

/**
 * Creates or updates a profile in Supabase after OAuth signup
 */
export async function ensureProfileExists(
  userId: string,
  email: string,
  name?: string,
  image?: string
): Promise<void> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check if profile exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) {
    // Create new profile with onboarding_complete = false
    const role = isAdminUser(email) ? 'admin' : 'candidate';
    const onboardingComplete = isAdminUser(email); // Admin skips onboarding

    await supabase.from('profiles').insert({
      user_id: userId,
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      image_url: image,
      role,
      onboarding_complete: onboardingComplete,
    });
  } else {
    // Update existing profile if needed
    await supabase
      .from('profiles')
      .update({
        email: email.toLowerCase(),
        name: name || existing.name,
        image_url: image || existing.image_url,
      })
      .eq('user_id', userId);
  }
}

