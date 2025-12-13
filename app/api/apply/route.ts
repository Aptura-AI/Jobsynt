import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { getServerSession } from '@/lib/auth';
import { getAuthTokenFromCookies, verifyToken } from '@/utils/auth';
import { readJSON, writeJSON } from '@/utils/fs';
import { v4 as uuid } from 'uuid';

type Application = {
  id: string;
  jobId?: string;
  scrapedJobId?: string;  // Bug 1 fix: Added scrapedJobId field
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
      // Bug 2 fix: Use maybeSingle() instead of single() to handle empty results gracefully
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();  // Bug 2 fix: Won't throw if no rows found

      const applicationData = {
        job_id: jobId || null,
        scraped_job_id: scrapedJobId || null,
        profile_id: profile?.id || null,
        email: email,
        status: 'pending',
        applied_at: new Date().toISOString(),
      };

      // Check if already applied - handle both jobId and scrapedJobId
      let existingQuery = supabase
        .from('job_applications')
        .select('id')
        .eq('email', email);
      
      // Bug 1 fix: Check both ID types for duplicates
      if (jobId) {
        existingQuery = existingQuery.eq('job_id', jobId);
      }
      if (scrapedJobId) {
        existingQuery = existingQuery.eq('scraped_job_id', scrapedJobId);
      }

      // Bug 2 fix: Use maybeSingle() - returns null instead of throwing when no rows
      const { data: existing } = await existingQuery.maybeSingle();

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
        scrapedJobId: data.scraped_job_id,
        email: data.email,
        createdAt: data.created_at,
        message: 'Application submitted successfully',
      }, { status: 201 });
    }

    // Fallback to JSON file
    try {
      const applications = await readJSON<Application[]>('applications.json');
      
      // Bug 1 fix: Check both jobId and scrapedJobId for duplicates
      const existing = applications.find(a => {
        if (a.email !== email) return false;
        if (jobId && a.jobId === jobId) return true;
        if (scrapedJobId && a.scrapedJobId === scrapedJobId) return true;
        return false;
      });
      
      if (existing) {
        return NextResponse.json({ message: 'Already applied to this job' }, { status: 400 });
      }

      // Bug 1 fix: Store both jobId and scrapedJobId
      const application: Application = {
        id: `app-${uuid()}`,
        jobId: jobId,
        scrapedJobId: scrapedJobId,
        email: email,
        createdAt: new Date().toISOString(),
      };
      applications.push(application);
      await writeJSON('applications.json', applications);
      return NextResponse.json({
        ...application,
        message: 'Application submitted successfully',
      }, { status: 201 });
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
