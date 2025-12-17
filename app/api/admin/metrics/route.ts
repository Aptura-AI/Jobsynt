import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import { createClient } from '@supabase/supabase-js';
import { get30DaysAgoDate } from '@/lib/job-filters';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Admin Metrics API
 * Returns executive metrics for admin dashboard
 */
export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication
    const cookieStore = cookies();
    const rawToken = cookieStore.get('jobsynth_token')?.value;

    if (!rawToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = verifyToken(rawToken);
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 1. Total candidates
    const { count: totalCandidates } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'candidate');

    // 2. Active candidates (last 7 days - logged in or had activity)
    const { count: activeCandidates } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'candidate')
      .gte('updated_at', `${sevenDaysAgo}T00:00:00Z`);

    // 3. Active jobs (last 30 days, is_active = true)
    const thirtyDaysAgo = get30DaysAgoDate();
    const { count: activeJobs } = await supabase
      .from('scraped_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .gte('posted_date', thirtyDaysAgo);

    // 4. Jobs matched today
    const { count: jobsMatchedToday } = await supabase
      .from('scraped_jobs')
      .select('*', { count: 'exact', head: true })
      .not('profile_id', 'is', null)
      .gte('fit_score', 70)
      .gte('updated_at', `${today}T00:00:00Z`);

    // 5. Avg match score (today)
    const { data: todayMatches } = await supabase
      .from('scraped_jobs')
      .select('fit_score')
      .not('profile_id', 'is', null)
      .gte('fit_score', 70)
      .gte('updated_at', `${today}T00:00:00Z`);

    const avgMatchScore = todayMatches && todayMatches.length > 0
      ? Math.round(todayMatches.reduce((sum, job) => sum + (job.fit_score || 0), 0) / todayMatches.length)
      : 0;

    // 6. Email open rate (last 24h)
    const { data: recentEmails } = await supabase
      .from('email_events')
      .select('opened_at')
      .eq('type', 'daily_matches')
      .gte('sent_at', `${yesterday}T00:00:00Z`);

    const emailsSent24h = recentEmails?.length || 0;
    const emailsOpened24h = recentEmails?.filter(e => e.opened_at).length || 0;
    const openRate24h = emailsSent24h > 0 ? Math.round((emailsOpened24h / emailsSent24h) * 100) : 0;

    return NextResponse.json({
      totalCandidates: totalCandidates || 0,
      activeCandidates: activeCandidates || 0,
      activeJobs: activeJobs || 0,
      jobsMatchedToday: jobsMatchedToday || 0,
      avgMatchScore,
      openRate24h,
      emailsSent24h,
      emailsOpened24h,
    });
  } catch (error: any) {
    console.error('Admin metrics error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

