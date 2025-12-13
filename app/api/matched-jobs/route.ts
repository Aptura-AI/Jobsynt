import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { getServerSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ jobs: [] });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ jobs: [] });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, tier')
      .eq('email', session.user.email)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ jobs: [] });
    }

    // Determine job limit based on tier
    const tier = profile.tier || 'free';
    const jobLimit = tier === 'free' ? 2 : tier === 'premium' ? 5 : 10;

    // Get recommended jobs (90%+ match, sorted by fit_score)
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('profile_id', profile.id)
      .gte('fit_score', 90)
      .eq('is_active', true)
      .order('fit_score', { ascending: false })
      .limit(jobLimit);

    if (error) {
      console.error('Error fetching matched jobs:', error);
      return NextResponse.json({ jobs: [] });
    }

    return NextResponse.json({ jobs: jobs || [] });
  } catch (error: any) {
    console.error('Matched jobs error:', error);
    return NextResponse.json({ jobs: [] });
  }
}
