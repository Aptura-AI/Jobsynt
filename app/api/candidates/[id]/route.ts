import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { readJSON, writeJSON } from '@/utils/fs';
import { getServerSession } from '@/lib/auth';
import { verifyToken } from '@/utils/auth';
import { getAuthTokenFromCookies } from '@/utils/auth.server';

type Candidate = {
  id: string;
  name?: string;
  email?: string;
  title?: string;
  location?: string;
  experience?: number;
  skills?: string[];
  status?: string;
  notes?: string;
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Try Supabase first
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        return NextResponse.json({
          id: data.id,
          name: data.name,
          email: data.email,
          title: data.title,
          location: data.location,
          experience: data.experience,
          skills: data.skills || [],
          visa: data.visa,
          rate: data.rate,
          availability: data.availability,
          summary: data.summary,
          projects: data.projects || [],
          status: data.status,
          notes: data.notes,
          resumeUrl: data.resume_url,
        });
      }

      if (error && error.code !== 'PGRST116') {
        console.error('Supabase error:', error);
      }
    }

    // Fallback to JSON file
    try {
      const candidates = await readJSON<Candidate[]>('candidates.json');
      const candidate = candidates.find((c) => c.id === id);
      if (!candidate) {
        return NextResponse.json({ message: 'Not found' }, { status: 404 });
      }
      return NextResponse.json(candidate);
    } catch {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('GET candidate error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    // Check NextAuth session
    const nextAuthSession = await getServerSession();
    const isNextAuthAdmin = nextAuthSession?.user?.role === 'admin';

    // Check JWT token
    const token = getAuthTokenFromCookies();
    const jwtSession = token ? verifyToken(token) : null;
    const isJwtAdmin = jwtSession?.role === 'admin';

    if (!isNextAuthAdmin && !isJwtAdmin) {
      return NextResponse.json({ message: 'Unauthorized - Admin only' }, { status: 401 });
    }

    const { id } = params;
    const payload = await req.json();

    // Try Supabase first
    if (isSupabaseConfigured()) {
      const updateData: any = {};
      if (payload.status !== undefined) updateData.status = payload.status;
      if (payload.notes !== undefined) updateData.notes = payload.notes;
      if (payload.name !== undefined) updateData.name = payload.name;
      if (payload.title !== undefined) updateData.title = payload.title;
      if (payload.location !== undefined) updateData.location = payload.location;
      if (payload.experience !== undefined) updateData.experience = payload.experience;
      if (payload.skills !== undefined) updateData.skills = payload.skills;

      const { data, error } = await supabase
        .from('candidates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    // Fallback to JSON file
    try {
      const candidates = await readJSON<Candidate[]>('candidates.json');
      const idx = candidates.findIndex((c) => c.id === id);
      if (idx === -1) {
        return NextResponse.json({ message: 'Not found' }, { status: 404 });
      }
      candidates[idx] = { ...candidates[idx], ...payload };
      await writeJSON('candidates.json', candidates);
      return NextResponse.json(candidates[idx]);
    } catch (fsError: any) {
      return NextResponse.json({ error: fsError.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error('PATCH candidate error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    // Check NextAuth session
    const nextAuthSession = await getServerSession();
    const isNextAuthAdmin = nextAuthSession?.user?.role === 'admin';

    // Check JWT token
    const token = getAuthTokenFromCookies();
    const jwtSession = token ? verifyToken(token) : null;
    const isJwtAdmin = jwtSession?.role === 'admin';

    if (!isNextAuthAdmin && !isJwtAdmin) {
      return NextResponse.json({ message: 'Unauthorized - Admin only' }, { status: 401 });
    }

    const { id } = params;

    // Try Supabase first
    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('candidates')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ message: 'Deleted successfully' });
    }

    // Fallback to JSON file
    try {
      const candidates = await readJSON<Candidate[]>('candidates.json');
      const filtered = candidates.filter((c) => c.id !== id);
      await writeJSON('candidates.json', filtered);
      return NextResponse.json({ message: 'Deleted successfully' });
    } catch (fsError: any) {
      return NextResponse.json({ error: fsError.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error('DELETE candidate error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
