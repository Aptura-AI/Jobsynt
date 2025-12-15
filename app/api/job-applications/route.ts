import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { getServerSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { job_id, applied } = await req.json();

    if (!job_id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', session.user.email)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (applied) {
      // Create application
      const { error } = await supabase
        .from('job_applications')
        .upsert({
          scraped_job_id: job_id,
          profile_id: profile.id,
          email: session.user.email,
          applied_at: new Date().toISOString(),
        }, { onConflict: 'scraped_job_id,profile_id' });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // Remove application
      const { error } = await supabase
        .from('job_applications')
        .delete()
        .eq('scraped_job_id', job_id)
        .eq('profile_id', profile.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Job application error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update application' }, { status: 500 });
  }
}

