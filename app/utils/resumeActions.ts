// app/utils/resumeActions.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASEURL!,
  process.env.NEXT_PUBLIC_SUPABASEKEY!
);

export async function saveProfileToSupabase(userId: string, profileData: any) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...profileData }, { onConflict: 'id' });

  if (error) throw error;
  return data;
}

export async function uploadResume(file: File): Promise<string> {
  const filePath = `resumes/${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage.from('resumes').upload(filePath, file);

  if (error) throw error;
  return data.path;
}