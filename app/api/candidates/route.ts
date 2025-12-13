import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { getServerSession } from '@/lib/auth';
import { readJSON, writeJSON } from '@/utils/fs';
import { v4 as uuid } from 'uuid';

type Candidate = {
  id: string;
  name: string;
  email?: string;
  title: string;
  location: string;
  experience: number;
  skills: string[];
  visa?: string;
  rate?: string;
  availability?: string;
  summary?: string;
  projects?: string[];
  status?: string;
  notes?: string;
  resumeUrl?: string;
};

export async function GET() {
  try {
    // Try Supabase first
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Transform to match expected format
        const candidates = data.map((c: any) => ({
          id: c.id,
          name: c.name || '',
          email: c.email,
          title: c.title || '',
          location: c.location || '',
          experience: c.experience || 0,
          skills: c.skills || [],
          visa: c.visa,
          rate: c.rate,
          availability: c.availability,
          summary: c.summary,
          projects: c.projects || [],
          status: c.status || 'Good',
          notes: c.notes || '',
          resumeUrl: c.resume_url || '',
        }));
        return NextResponse.json(candidates);
      }
      
      if (error) {
        console.log('Supabase candidates error:', error.message);
      }
    }

    // Fallback to JSON file
    try {
      const candidates = await readJSON<Candidate[]>('candidates.json');
      return NextResponse.json(candidates);
    } catch {
      return NextResponse.json([]);
    }
  } catch (error: any) {
    console.error('GET candidates error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Get session to link profile if authenticated
    const session = await getServerSession();
    const email = payload.email || session?.user?.email;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Try Supabase first
    if (isSupabaseConfigured()) {
      // First, create/update profile
      const profileData = {
        email: email,
        name: payload.name,
        title: payload.title,
        location: payload.location,
        experience_years: Number(payload.experience || 0),
        skills: payload.skills || [],
        visa_status: payload.visa,
        rate_expectation: payload.rate,
        availability: payload.availability,
        summary: payload.summary,
        projects: payload.projects?.filter((p: string) => p && p.trim()) || [],
        preferred_job_type: payload.preferredJobType || 'remote',
      };

      // Upsert profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'email' })
        .select()
        .single();

      if (profileError) {
        console.error('Profile upsert error:', profileError);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      // Also create/update candidate record for talent pool
      const candidateData = {
        profile_id: profile.id,
        name: payload.name,
        email: email,
        title: payload.title,
        location: payload.location,
        experience: Number(payload.experience || 0),
        skills: payload.skills || [],
        visa: payload.visa,
        rate: payload.rate,
        availability: payload.availability,
        summary: payload.summary,
        projects: payload.projects?.filter((p: string) => p && p.trim()) || [],
        status: 'Good',
        resume_url: payload.resumeUrl || '',
      };

      // Check if candidate exists
      const { data: existingCandidate } = await supabase
        .from('candidates')
        .select('id')
        .eq('email', email)
        .single();

      let candidate;
      if (existingCandidate) {
        const { data, error } = await supabase
          .from('candidates')
          .update(candidateData)
          .eq('id', existingCandidate.id)
          .select()
          .single();
        if (error) throw error;
        candidate = data;
      } else {
        const { data, error } = await supabase
          .from('candidates')
          .insert(candidateData)
          .select()
          .single();
        if (error) throw error;
        candidate = data;
      }

      return NextResponse.json({
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        title: candidate.title,
        location: candidate.location,
        experience: candidate.experience,
        skills: candidate.skills,
        visa: candidate.visa,
        rate: candidate.rate,
        availability: candidate.availability,
        summary: candidate.summary,
        projects: candidate.projects,
        status: candidate.status,
        message: 'Profile saved successfully!',
      }, { status: 201 });
    }

    // Fallback to JSON file (local dev only)
    try {
      const candidates = await readJSON<Candidate[]>('candidates.json');
      const candidate: Candidate = {
        id: payload.id || `cand-${uuid()}`,
        name: payload.name,
        email: email,
        title: payload.title,
        location: payload.location,
        experience: Number(payload.experience || 0),
        skills: payload.skills || [],
        visa: payload.visa,
        rate: payload.rate,
        availability: payload.availability,
        summary: payload.summary,
        projects: payload.projects || [],
        status: 'Good',
        notes: '',
        resumeUrl: payload.resumeUrl || '',
      };
      
      // Update if exists, otherwise add
      const existingIdx = candidates.findIndex(c => c.email === email);
      if (existingIdx >= 0) {
        candidates[existingIdx] = { ...candidates[existingIdx], ...candidate };
      } else {
        candidates.push(candidate);
      }
      
      await writeJSON('candidates.json', candidates);
      return NextResponse.json({ ...candidate, message: 'Profile saved successfully!' }, { status: 201 });
    } catch (fsError: any) {
      return NextResponse.json({ 
        error: 'Database not configured properly. Please contact support.',
        details: fsError.message 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('POST candidates error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
