import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { getServerSession } from '@/lib/auth';
import { getAuthTokenFromCookies, verifyToken } from '@/utils/auth';
import { readJSON, writeJSON } from '@/utils/fs';
import { v4 as uuid } from 'uuid';

type Application = {
  id: string;
  jobId: string;
  email: string;
  createdAt: string;
};

export async function POST(req: Request) {
  try {
    // Check NextAuth session first
    const nextAuthSession = await getServerSession();
    
    // Fallback to JWT token
    const token = getAuthTokenFromCookies();
    const jwtSession = token ? verifyToken(token) : null;

    const email = nextAuthSession?.user?.email || jwtSession?.email;

    if (!email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { jobId, scrapedJobId } = payload;

    if (!jobId && !scrapedJobId) {
      return NextResponse.json({ message: 'Job ID required' }, { status: 400 });
    }

    // Try Supabase first
    if (isSupabaseConfigured()) {
      // Get user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      const applicationData = {
        job_id: jobId || null,
        scraped_job_id: scrapedJobId || null,
        profile_id: profile?.id || null,
        email: email,
        status: 'pending',
        applied_at: new Date().toISOString(),
      };

      // Check if already applied
      const { data: existing } = await supabase
        .from('job_applications')
        .select('id')
        .eq('email', email)
        .eq(jobId ? 'job_id' : 'scraped_job_id', jobId || scrapedJobId)
        .single();

      if (existing) {
        return NextResponse.json({ message: 'Already applied to this job' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('job_applications')
        .insert(applicationData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        id: data.id,
        jobId: data.job_id,
        email: data.email,
        createdAt: data.created_at,
        message: 'Application submitted successfully',
      }, { status: 201 });
    }

    // Fallback to JSON file
    try {
      const applications = await readJSON<Application[]>('applications.json');
      
      // Check if already applied
      const existing = applications.find(a => a.jobId === jobId && a.email === email);
      if (existing) {
        return NextResponse.json({ message: 'Already applied to this job' }, { status: 400 });
      }

      const application: Application = {
        id: `app-${uuid()}`,
        jobId: jobId,
        email: email,
        createdAt: new Date().toISOString(),
      };
      applications.push(application);
      await writeJSON('applications.json', applications);
      return NextResponse.json(application, { status: 201 });
    } catch (fsError: any) {
      return NextResponse.json({ 
        error: 'Database not configured',
        details: fsError.message 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('POST apply error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    // Check NextAuth session first
    const nextAuthSession = await getServerSession();
    
    // Fallback to JWT token
    const token = getAuthTokenFromCookies();
    const jwtSession = token ? verifyToken(token) : null;

    const email = nextAuthSession?.user?.email || jwtSession?.email;

    if (!email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Try Supabase first
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          *,
          jobs:job_id (*),
          scraped_jobs:scraped_job_id (*)
        `)
        .eq('email', email)
        .order('applied_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data || []);
    }

    // Fallback to JSON file
    try {
      const applications = await readJSON<Application[]>('applications.json');
      const userApplications = applications.filter(a => a.email === email);
      return NextResponse.json(userApplications);
    } catch {
      return NextResponse.json([]);
    }
  } catch (error: any) {
    console.error('GET applications error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
