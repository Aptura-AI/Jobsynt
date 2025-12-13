import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ jobs: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (!profile) {
      return NextResponse.json({ jobs: [] });
    }

    // Get matched jobs for the user
    const { data: matchedJobs, error } = await supabase
      .from('matched_jobs')
      .select(`
        *,
        scraped_jobs (
          id,
          title,
          company,
          location,
          salary,
          description,
          url,
          posted_date,
          source
        )
      `)
      .eq('profile_id', profile.id)
      .order('fit_score', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching matched jobs:', error);
      return NextResponse.json({ jobs: [] });
    }

    return NextResponse.json({ jobs: matchedJobs || [] });
  } catch (error) {
    console.error('Matched jobs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

