/**
 * Diagnostic endpoint to check why jobs aren't showing on candidate dashboard
 * GET /api/debug/job-visibility?candidateId=xxx
 */
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

    const candidateId = req.nextUrl.searchParams.get('candidateId');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get candidate profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', session.user.email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const targetCandidateId = candidateId || profile.id;

    // Step 1: Get all jobs in scraped_jobs
    const { data: allJobs } = await supabase
      .from('scraped_jobs')
      .select('id, title, company, primary_platform, is_active')
      .eq('is_active', true)
      .limit(100);

    // Step 2: Get all matches for this candidate
    const { data: allMatches } = await supabase
      .from('candidate_job_matches')
      .select('*')
      .eq('candidate_id', targetCandidateId);

    // Step 3: Get candidate platform info
    const { data: candidateProfile } = await supabase
      .from('profiles')
      .select('id, email, name, primary_platform, secondary_platforms')
      .eq('id', targetCandidateId)
      .single();

    // Step 4: Analyze each match
    const analysis = {
      candidate: {
        id: candidateProfile?.id,
        email: candidateProfile?.email,
        name: candidateProfile?.name,
        primary_platform: candidateProfile?.primary_platform || 'NOT SET',
        secondary_platforms: candidateProfile?.secondary_platforms || [],
      },
      summary: {
        total_jobs_in_db: allJobs?.length || 0,
        total_matches_in_ledger: allMatches?.length || 0,
        visible_matches: 0,
        hidden_by_platform: 0,
        hidden_by_ai: 0,
        applied: 0,
        dismissed: 0,
        active: 0,
      },
      matches: [] as any[],
    };

    // Analyze each match
    for (const match of allMatches || []) {
      const job = allJobs?.find(j => j.id === match.job_id);
      
      const matchAnalysis: any = {
        job_id: match.job_id,
        job_title: job?.title || 'JOB NOT FOUND',
        job_company: job?.company || 'UNKNOWN',
        job_platform: job?.primary_platform || 'NOT SET',
        match_score: match.match_score,
        match_source: match.match_source,
        ai_priority: match.ai_priority || 'NOT SET',
        
        // Lifecycle status
        visibility_status: match.visibility_status || 'UNKNOWN',
        applied_at: match.applied_at,
        dismissed_at: match.dismissed_at,
        
        // AI visibility
        ai_visibility: match.ai_visibility || 'NOT SET',
        hidden_reason: match.hidden_reason,
        hidden_at: match.hidden_at,
        
        // Platform gating check
        platform_match: 'UNKNOWN',
        platform_gating_passed: false,
        
        // Why not visible
        not_visible_reasons: [] as string[],
      };

      // Check platform gating
      if (candidateProfile?.primary_platform && job?.primary_platform) {
        const candidatePlatform = candidateProfile.primary_platform.toLowerCase();
        const jobPlatform = job.primary_platform.toLowerCase();
        const secondaryPlatforms = (candidateProfile.secondary_platforms || []).map(p => p.toLowerCase());
        
        if (candidatePlatform === jobPlatform) {
          matchAnalysis.platform_match = 'PRIMARY_MATCH';
          matchAnalysis.platform_gating_passed = true;
        } else if (secondaryPlatforms.includes(jobPlatform)) {
          matchAnalysis.platform_match = 'SECONDARY_MATCH';
          matchAnalysis.platform_gating_passed = true;
        } else {
          matchAnalysis.platform_match = 'MISMATCH';
          matchAnalysis.platform_gating_passed = false;
          matchAnalysis.not_visible_reasons.push(`Platform mismatch: candidate=${candidatePlatform}, job=${jobPlatform}`);
        }
      } else {
        matchAnalysis.platform_match = 'NOT_CHECKED';
        matchAnalysis.platform_gating_passed = true; // Default to true if platforms not set
      }

      // Check why not visible
      if (match.visibility_status !== 'active') {
        if (match.applied_at) {
          matchAnalysis.not_visible_reasons.push('Job is applied');
          analysis.summary.applied++;
        }
        if (match.dismissed_at) {
          matchAnalysis.not_visible_reasons.push('Job is dismissed');
          analysis.summary.dismissed++;
        }
      } else {
        analysis.summary.active++;
      }

      if (match.ai_visibility === 'hidden_by_ai') {
        matchAnalysis.not_visible_reasons.push(`Hidden by AI: ${match.hidden_reason || 'unknown reason'}`);
        analysis.summary.hidden_by_ai++;
        if (match.hidden_reason?.includes('platform')) {
          analysis.summary.hidden_by_platform++;
        }
      } else if (match.ai_visibility === 'visible') {
        analysis.summary.visible_matches++;
      }

      // Final visibility check (what GET endpoint would return)
      const wouldBeVisible = 
        match.visibility_status === 'active' && 
        match.ai_visibility === 'visible' &&
        !match.applied_at &&
        !match.dismissed_at;

      matchAnalysis.would_be_visible_in_dashboard = wouldBeVisible;

      analysis.matches.push(matchAnalysis);
    }

    // Step 5: Check what GET endpoint would return
    const { data: getEndpointMatches } = await supabase
      .from('candidate_job_matches')
      .select('*')
      .eq('candidate_id', targetCandidateId)
      .eq('visibility_status', 'active')
      .eq('ai_visibility', 'visible');

    analysis.summary.get_endpoint_would_return = getEndpointMatches?.length || 0;

    return NextResponse.json(analysis, { status: 200 });
  } catch (error: any) {
    console.error('[Job Visibility Debug] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      stack: error.stack 
    }, { status: 500 });
  }
}

