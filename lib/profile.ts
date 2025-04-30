// lib/profile.ts

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export interface ProfileData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  location: string;
  resume?: string;
}

/**
 * Fetch the current user's profile (first_name, last_name, email, phone, location, resume)
 */
export async function getProfileData(): Promise<ProfileData | null> {
  const supabase = createClientComponentClient();

  const { data, error } = await supabase
    .from('profile')
    .select('first_name, last_name, email, phone, location, resume')
    .single();

  if (error) {
    console.error('Error fetching profile', error);
    return null;
  }

  // `data` will already match the shape of ProfileData
  return data;
}

/**
 * Upsert (insert or update) a profile row.
 * Saves only the fields defined on ProfileData.
 */
export async function saveProfileData(profileData: ProfileData): Promise<boolean> {
  const supabase = createClientComponentClient();

  const { error } = await supabase
    .from('profile')
    .upsert(profileData);

  if (error) {
    console.error('Error saving profile', error);
    return false;
  }

  return true;
}
