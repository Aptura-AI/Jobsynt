import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';
import { ALLOWED_JOB_TYPES, isValidJobType } from '@/lib/job-types';
import { normalizeVisaStatus, isValidVisaStatus } from '@/lib/visa-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

// GET - Fetch user profile
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', session.user.email)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      if (error.code === '42P01') {
        return NextResponse.json({ profile: null, error: 'Table not found' });
      }
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    return NextResponse.json({ profile: profile || null });
  } catch (error: any) {
    console.error('Profile GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create/Update user profile
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ 
        error: 'Database not configured. Please run the SQL schema in Supabase.' 
      }, { status: 500 });
    }

    // Parse body with error handling
    let body;
    try {
      const text = await req.text();
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 });
    }

    // Clean and prepare profile data
    const name = String(body.name || session.user.name || '').trim();
    const title = String(body.title || '').trim();
    const location = String(body.location || '').trim();
    const skills = Array.isArray(body.skills) ? body.skills.filter(Boolean) : [];
    
    // Validate and process preferred_job_types
    let preferred_job_types: string[] = [];
    if (Array.isArray(body.preferred_job_types)) {
      // Filter and validate each job type
      preferred_job_types = body.preferred_job_types
        .filter((type: any) => type && typeof type === 'string')
        .map((type: string) => type.trim().toLowerCase())
        .filter((type: string) => isValidJobType(type));
      
      // Remove duplicates
      preferred_job_types = Array.from(new Set(preferred_job_types));
    }
    // If empty array, it means "show all jobs" (no filtering)
    
    // Determine if onboarding is complete (has required fields)
    const hasRequiredFields = name && title && location && skills.length > 0;
    
    const profileData = {
      email: String(session.user.email).trim().toLowerCase(),
      name,
      phone: String(body.phone || '').trim() || null,
      title,
      location,
      experience_years: Number(body.experience_years) || 0,
      skills,
      contract_type: Array.isArray(body.contract_type) ? body.contract_type : [],
      work_mode: Array.isArray(body.work_mode) ? body.work_mode : [],
      preferred_job_types, // JSONB array of job types
      preferred_job_type: String(body.preferred_job_type || 'remote').trim(), // Keep for backward compatibility
      visa_status: normalizeVisaStatus(body.visa_status || body.visa), // Normalize and save enum value
      rate_expectation: String(body.rate_expectation || '').trim() || null,
      availability: String(body.availability || 'immediate').trim(),
      summary: String(body.summary || '').trim() || null,
      image_url: session.user.image || null,
      onboarding_complete: hasRequiredFields, // Mark complete if required fields are present
    };

    // Use upsert to handle both create and update
    const { data: profile, error } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'email' })
      .select()
      .single();

    if (error) {
      console.error('Error saving profile:', error);
      if (error.code === '42P01') {
        return NextResponse.json({ 
          error: 'Database table "profiles" not found. Please run the SQL schema in Supabase Dashboard.' 
        }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger immediate job matching after profile save
    try {
      const matchRes = await fetch(`${req.nextUrl.origin}/api/match-jobs`, {
        method: 'POST',
        headers: {
          'Cookie': req.headers.get('cookie') || '',
        },
      });
      
      if (matchRes.ok) {
        const matchData = await matchRes.json();
        console.log(`[Profile Save] Triggered matching: ${matchData.matchesFound} jobs found`);
      }
    } catch (matchError) {
      // Don't fail profile save if matching fails
      console.error('Error triggering job matching:', matchError);
    }

    return NextResponse.json({ profile, message: 'Profile saved successfully' });
  } catch (error: any) {
    console.error('Profile POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update user profile
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    let body;
    try {
      const text = await req.text();
      body = JSON.parse(text);
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 });
    }

    // Validate and process preferred_job_types for PUT
    let preferred_job_types: string[] = [];
    if (Array.isArray(body.preferred_job_types)) {
      preferred_job_types = body.preferred_job_types
        .filter((type: any) => type && typeof type === 'string')
        .map((type: string) => type.trim().toLowerCase())
        .filter((type: string) => isValidJobType(type));
      preferred_job_types = Array.from(new Set(preferred_job_types));
    }

    // Process structured skills
    const primary_skills = Array.isArray(body.primary_skills) 
      ? body.primary_skills.filter(Boolean).slice(0, 3) // Max 3 primary skills
      : [];
    const secondary_skills = Array.isArray(body.secondary_skills) 
      ? body.secondary_skills.filter(Boolean) 
      : [];
    const adjacent_skills = Array.isArray(body.adjacent_skills) 
      ? body.adjacent_skills.filter(Boolean) 
      : [];
    const generic_skills = Array.isArray(body.generic_skills) 
      ? body.generic_skills.filter(Boolean) 
      : [];

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        name: body.name,
        phone: body.phone || null,
        title: body.title,
        location: body.location,
        experience_years: body.experience_years,
        skills: body.skills,
        // Structured skills
        primary_skills,
        secondary_skills,
        adjacent_skills,
        generic_skills,
        contract_type: body.contract_type,
        work_mode: body.work_mode,
        preferred_job_types,
        preferred_job_type: body.preferred_job_type,
        visa_status: normalizeVisaStatus(body.visa_status || body.visa),
        rate_expectation: body.rate_expectation,
        availability: body.availability,
        summary: body.summary,
      })
      .eq('email', session.user.email)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger immediate job matching after profile update
    try {
      const matchRes = await fetch(`${req.nextUrl.origin}/api/match-jobs`, {
        method: 'POST',
        headers: {
          'Cookie': req.headers.get('cookie') || '',
        },
      });
      
      if (matchRes.ok) {
        const matchData = await matchRes.json();
        console.log(`[Profile Update] Triggered matching: ${matchData.matchesFound} jobs found`);
      }
    } catch (matchError) {
      // Don't fail profile update if matching fails
      console.error('Error triggering job matching:', matchError);
    }

    return NextResponse.json({ profile, message: 'Profile updated successfully' });
  } catch (error: any) {
    console.error('Profile PUT error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
