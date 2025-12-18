/**
 * AI RANKING CRON - Runs at 11:30 AM Daily
 * 
 * LEDGER RULES:
 * - Run AI ranking ONLY for candidates with:
 *   - New qualified jobs (qualified_at > last_ranked_at), OR
 *   - last_ranked_at < now() - 24h, OR
 *   - last_ranked_at IS NULL
 * - AI updates ONLY: ai_priority, last_ranked_at
 * - AI NEVER: inserts rows, updates fit_score, deletes/dismisses jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rankJobsWithAI, CandidateProfile } from '@/lib/matching/rankJobsWithAI';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Verify cron secret for security
function verifyCronSecret(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.warn('[Rank Jobs Cron] CRON_SECRET not set');
    return true; // Allow in development
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Security check
    if (!verifyCronSecret(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[Rank Jobs Cron] Starting AI ranking for eligible candidates...');

    // 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const twentyFourHoursAgoStr = twentyFourHoursAgo.toISOString();

    // Find candidates who need ranking:
    // 1. Have active jobs (visibility_status = 'active' or NULL)
    // 2. AND (last_ranked_at IS NULL OR last_ranked_at < 24h ago OR have new jobs)
    const { data: candidatesNeedingRanking, error: queryError } = await supabase
      .from('candidate_job_matches')
      .select('candidate_id')
      .is('applied_at', null)
      .is('dismissed_at', null)
      .or(`last_ranked_at.is.null,last_ranked_at.lt.${twentyFourHoursAgoStr}`);

    if (queryError) {
      console.error('[Rank Jobs Cron] Error finding candidates:', queryError);
      return NextResponse.json({ 
        error: 'Failed to find candidates for ranking',
        details: queryError.message 
      }, { status: 500 });
    }

    // Get unique candidate IDs
    const candidateIds = [...new Set((candidatesNeedingRanking || []).map(m => m.candidate_id))];

    console.log(`[Rank Jobs Cron] ${candidateIds.length} candidates need ranking`);

    if (candidateIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No candidates need ranking at this time',
        candidatesProcessed: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Get candidate profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', candidateIds);

    if (profilesError || !profiles) {
      console.error('[Rank Jobs Cron] Error fetching profiles:', profilesError);
      return NextResponse.json({ 
        error: 'Failed to fetch candidate profiles',
        details: profilesError?.message 
      }, { status: 500 });
    }

    let candidatesRanked = 0;
    let jobsRanked = 0;
    const errors: string[] = [];

    for (const profile of profiles) {
      try {
        // Check if candidate actually needs ranking (double-check guard)
        const { data: recentRanking } = await supabase
          .from('candidate_job_matches')
          .select('last_ranked_at, qualified_at')
          .eq('candidate_id', profile.id)
          .is('applied_at', null)
          .is('dismissed_at', null)
          .order('last_ranked_at', { ascending: false, nullsFirst: true })
          .limit(1)
          .single();

        // 24h GUARD: Skip if recently ranked and no new jobs
        if (recentRanking?.last_ranked_at) {
          const lastRanked = new Date(recentRanking.last_ranked_at);
          const qualifiedAt = recentRanking.qualified_at 
            ? new Date(recentRanking.qualified_at) 
            : null;
          
          // If ranked within 24h AND no newer jobs qualified, skip
          if (lastRanked > twentyFourHoursAgo && 
              (!qualifiedAt || qualifiedAt <= lastRanked)) {
            console.log(`[Rank Jobs Cron] Skipping ${profile.id.substring(0, 8)}... (recently ranked, no new jobs)`);
            continue;
          }
        }

        // Run AI ranking
        const candidateData: CandidateProfile = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          title: profile.title,
          location: profile.location,
          skills: profile.skills,
          experience_years: profile.experience_years,
          preferred_job_types: profile.preferred_job_types,
          rate_expectation: profile.rate_expectation,
          expected_pay_min: profile.expected_pay_min,
          work_mode: profile.work_mode,
          contract_type: profile.contract_type,
          visa_status: profile.visa_status,
          summary: profile.summary,
          resume_text: profile.resume_text,
          degrees: profile.degrees,
          certifications: profile.certifications,
        };

        const rankingResult = await rankJobsWithAI(profile.id, candidateData);
        
        // AI ranking automatically updates ai_priority and last_ranked_at in the ledger
        jobsRanked += rankingResult.jobs.length;
        candidatesRanked++;

        console.log(`[Rank Jobs Cron] Ranked ${rankingResult.jobs.length} jobs for candidate ${profile.id.substring(0, 8)}...`);
      } catch (err: any) {
        errors.push(`${profile.id}: ${err.message}`);
        console.error(`[Rank Jobs Cron] Error ranking for ${profile.id}:`, err.message);
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[Rank Jobs Cron] Completed in ${duration}ms`);
    console.log(`[Rank Jobs Cron] ${candidatesRanked} candidates ranked, ${jobsRanked} jobs updated`);

    return NextResponse.json({
      success: true,
      candidatesEligible: candidateIds.length,
      candidatesRanked,
      jobsRanked,
      errors: errors.length > 0 ? errors : undefined,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Rank Jobs Cron] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

