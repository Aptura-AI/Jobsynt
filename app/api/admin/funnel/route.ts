import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Admin Funnel API
 * Returns candidate funnel metrics
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

    // 1. Registered candidates (all profiles with role='candidate')
    const { count: registeredCandidates } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'candidate');

    // 2. Profiles completed (onboarding_complete = true)
    const { count: profilesCompleted } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'candidate')
      .eq('onboarding_complete', true);

    // 3. Candidates with ≥1 matched job
    const { data: matchedJobs } = await supabase
      .from('scraped_jobs')
      .select('profile_id')
      .not('profile_id', 'is', null)
      .gte('fit_score', 70);

    const uniqueMatchedCandidates = new Set(matchedJobs?.map(j => j.profile_id).filter(Boolean) || []).size;

    // 4. Candidates emailed (have email_events)
    const { data: emailedCandidates } = await supabase
      .from('email_events')
      .select('email')
      .eq('type', 'daily_matches');

    const uniqueEmailedCandidates = new Set(emailedCandidates?.map(e => e.email).filter(Boolean) || []).size;

    // 5. Candidates who opened email
    const { data: openedEmails } = await supabase
      .from('email_events')
      .select('email')
      .eq('type', 'daily_matches')
      .not('opened_at', 'is', null);

    const uniqueOpenedCandidates = new Set(openedEmails?.map(e => e.email).filter(Boolean) || []).size;

    const registeredCandidatesCount = registeredCandidates || 0;
    const profilesCompletedCount = profilesCompleted || 0;

    return NextResponse.json({
      registeredCandidates: registeredCandidatesCount,
      profilesCompleted: profilesCompletedCount,
      candidatesWithMatches: uniqueMatchedCandidates,
      candidatesEmailed: uniqueEmailedCandidates,
      candidatesOpenedEmail: uniqueOpenedCandidates,
      completionRate: registeredCandidatesCount > 0
        ? Math.round((profilesCompletedCount / registeredCandidatesCount) * 100)
        : 0,
      matchRate: registeredCandidatesCount > 0
        ? Math.round((uniqueMatchedCandidates / registeredCandidatesCount) * 100)
        : 0,
      emailOpenRate: uniqueEmailedCandidates > 0
        ? Math.round((uniqueOpenedCandidates / uniqueEmailedCandidates) * 100)
        : 0,
    });
  } catch (error: any) {
    console.error('Admin funnel error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

