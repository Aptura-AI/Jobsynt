import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { getServerSession } from '@/lib/auth';
import { getAuthTokenFromCookies, verifyToken } from '@/utils/auth';
import { readJSON, writeJSON } from '@/utils/fs';
import { v4 as uuid } from 'uuid';

type Application = {
  id: string;
  jobId?: string;
  scrapedJobId?: string;
  email: string;
  createdAt: string;
};

export async function POST(req: Request) {
  try {
    const nextAuthSession = await getServerSession();
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

    if (isSupabaseConfigured()) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      let existingQuery = supabase
        .from('job_applications')
        .select('id')
        .eq('email', email);
      
      if (jobId) existingQuery = existingQuery.eq('job_id', jobId);
      if (scrapedJobId) existingQuery = existingQuery.eq('scraped_job_id', scrapedJobId);

      const { data: existing } = await existingQuery.maybeSingle();

      if (existing) {
        return NextResponse.json({ message: 'Already applied to this job' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('job_applications')
        .insert({
          job_id: jobId || null,
          scraped_job_id: scrapedJobId || null,
          profile_id: profile?.id || null,
          email,
          status: 'pending',
          applied_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        id: data.id,
        jobId: data.job_id,
        scrapedJobId: data.scraped_job_id,
        email: data.email,
        createdAt: data.created_at,
        message: 'Application submitted successfully',
      }, { status: 201 });
    }

    try {
      const applications = await readJSON<Application[]>('applications.json');
      
      const existing = applications.find(a => {
        if (a.email !== email) return false;
        if (jobId && a.jobId === jobId) return true;
        if (scrapedJobId && a.scrapedJobId === scrapedJobId) return true;
        return false;
      });
      
      if (existing) {
        return NextResponse.json({ message: 'Already applied to this job' }, { status: 400 });
      }

      const application: Application = {
        id: `app-${uuid()}`,
        jobId,
        scrapedJobId,
        email,
        createdAt: new Date().toISOString(),
      };
      applications.push(application);
      await writeJSON('applications.json', applications);
      return NextResponse.json({ ...application, message: 'Application submitted successfully' }, { status: 201 });
    } catch (fsError: any) {
      return NextResponse.json({ error: 'Database not configured', details: fsError.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error('POST apply error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const nextAuthSession = await getServerSession();
    const token = getAuthTokenFromCookies();
    const jwtSession = token ? verifyToken(token) : null;
    const email = nextAuthSession?.user?.email || jwtSession?.email;

    if (!email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('job_applications')
        .select('*, jobs:job_id (*), scraped_jobs:scraped_job_id (*)')
        .eq('email', email)
        .order('applied_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data || []);
    }

    try {
      const applications = await readJSON<Application[]>('applications.json');
      return NextResponse.json(applications.filter(a => a.email === email));
    } catch {
      return NextResponse.json([]);
    }
  } catch (error: any) {
    console.error('GET applications error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
