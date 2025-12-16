import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { getServerSession } from '@/lib/auth';
import { ALLOWED_JOB_TYPES, isValidJobType } from '@/lib/job-types';

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase GET error:', error);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('GET candidates error:', error);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    // Parse JSON with error handling
    let payload;
    try {
      const text = await req.text();
      payload = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    // Get session for email
    const session = await getServerSession();
    const email = payload.email || session?.user?.email;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ 
        error: 'Database not configured. Please run the SQL schema in Supabase.' 
      }, { status: 500 });
    }

    // Prepare candidate data - clean and sanitize
    const candidateData = {
      name: String(payload.name || '').trim(),
      email: String(email).trim().toLowerCase(),
      title: String(payload.title || '').trim(),
      location: String(payload.location || '').trim(),
      experience: Number(payload.experience) || 0,
      skills: Array.isArray(payload.skills) ? payload.skills.filter(Boolean) : [],
      visa: String(payload.visa || '').trim() || null,
      rate: String(payload.rate || '').trim() || null,
      availability: String(payload.availability || '').trim() || null,
      summary: String(payload.summary || '').trim() || null,
      projects: Array.isArray(payload.projects) 
        ? payload.projects.filter((p: any) => p && String(p).trim()) 
        : [],
      status: 'Good',
      resume_url: String(payload.resumeUrl || '').trim() || null,
    };

    // Check if candidate exists
    const { data: existing, error: checkError } = await supabase
      .from('candidates')
      .select('id')
      .eq('email', candidateData.email)
      .maybeSingle();

    if (checkError) {
      console.error('Check existing error:', checkError);
      // Table might not exist - provide helpful error
      if (checkError.code === '42P01') {
        return NextResponse.json({ 
          error: 'Database table "candidates" not found. Please run the SQL schema in Supabase Dashboard.' 
        }, { status: 500 });
      }
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('candidates')
        .update(candidateData)
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) {
        console.error('Update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('candidates')
        .insert(candidateData)
        .select()
        .single();
      
      if (error) {
        console.error('Insert error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    }

    // Validate and process preferred_job_types from payload
    let preferred_job_types: string[] = [];
    if (Array.isArray(payload.preferred_job_types)) {
      preferred_job_types = payload.preferred_job_types
        .filter((type: any) => type && typeof type === 'string')
        .map((type: string) => type.trim().toLowerCase())
        .filter((type: string) => isValidJobType(type));
      preferred_job_types = Array.from(new Set(preferred_job_types));
    }

    // Also try to update profiles table (don't fail if it doesn't work)
    // Mark onboarding_complete if required fields are present
    const hasRequiredFields = candidateData.name && candidateData.title && 
                              candidateData.location && candidateData.skills.length > 0;
    
    try {
      await supabase
        .from('profiles')
        .upsert({
          email: candidateData.email,
          name: candidateData.name,
          title: candidateData.title,
          location: candidateData.location,
          experience_years: candidateData.experience,
          skills: candidateData.skills,
          preferred_job_types, // JSONB array
          visa_status: candidateData.visa,
          rate_expectation: candidateData.rate,
          availability: candidateData.availability,
          summary: candidateData.summary,
          projects: candidateData.projects,
          onboarding_complete: hasRequiredFields, // Mark complete when required fields are saved
        }, { onConflict: 'email' });
    } catch (profileError) {
      console.log('Profile update skipped (table may not exist):', profileError);
    }

    return NextResponse.json({ 
      ...result, 
      message: 'Profile saved successfully!' 
    }, { status: 201 });

  } catch (error: any) {
    console.error('POST candidates error:', error);
    return NextResponse.json({ 
      error: error.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}
