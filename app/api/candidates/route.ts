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
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return NextResponse.json(data.map((c: any) => ({
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
        })));
      }
      if (error) console.log('Supabase candidates error:', error.message);
    }

    try {
      return NextResponse.json(await readJSON<Candidate[]>('candidates.json'));
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
    const session = await getServerSession();
    const email = payload.email || session?.user?.email;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .upsert({
          email,
          name: payload.name,
          title: payload.title,
          location: payload.location,
          experience_years: Number(payload.experience || 0),
          skills: payload.skills || [],
          visa_status: payload.visa,
          rate_expectation: payload.rate,
          availability: payload.availability,
          summary: payload.summary,
          projects: payload.projects?.filter((p: string) => p?.trim()) || [],
          preferred_job_type: payload.preferredJobType || 'remote',
        }, { onConflict: 'email' })
        .select()
        .single();

      if (profileError) {
        console.error('Profile upsert error:', profileError);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      const candidateData = {
        profile_id: profile.id,
        name: payload.name,
        email,
        title: payload.title,
        location: payload.location,
        experience: Number(payload.experience || 0),
        skills: payload.skills || [],
        visa: payload.visa,
        rate: payload.rate,
        availability: payload.availability,
        summary: payload.summary,
        projects: payload.projects?.filter((p: string) => p?.trim()) || [],
        status: 'Good',
        resume_url: payload.resumeUrl || '',
      };

      const { data: existingCandidate } = await supabase
        .from('candidates')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      let candidate;
      if (existingCandidate) {
        const { data, error } = await supabase
          .from('candidates')
          .update(candidateData)
          .eq('id', existingCandidate.id)
          .select()
          .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        candidate = data;
      } else {
        const { data, error } = await supabase
          .from('candidates')
          .insert(candidateData)
          .select()
          .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        candidate = data;
      }

      return NextResponse.json({ ...candidate, message: 'Profile saved successfully!' }, { status: 201 });
    }

    try {
      const candidates = await readJSON<Candidate[]>('candidates.json');
      const candidate: Candidate = {
        id: payload.id || `cand-${uuid()}`,
        name: payload.name,
        email,
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
      
      const existingIdx = candidates.findIndex(c => c.email === email);
      if (existingIdx >= 0) {
        candidates[existingIdx] = { ...candidates[existingIdx], ...candidate };
      } else {
        candidates.push(candidate);
      }
      
      await writeJSON('candidates.json', candidates);
      return NextResponse.json({ ...candidate, message: 'Profile saved successfully!' }, { status: 201 });
    } catch (fsError: any) {
      return NextResponse.json({ error: 'Database not configured', details: fsError.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error('POST candidates error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
