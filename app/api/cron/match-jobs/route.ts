/**
 * MATCHING CRON - Runs at 11:00 AM Daily
 * 
 * LEDGER RULES:
 * - Qualify NEW jobs only
 * - Insert into candidate_job_matches
 * - DO NOT touch existing rows
 * - DO NOT re-score or re-evaluate
 * 
 * AFTER MATCHING:
 * - Automatically runs AI ranking for candidates with new jobs
 * - This eliminates the need for a separate rank-jobs cron
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchAndMatchJobs } from '@/lib/matching/getEligibleJobs';
import { logJobQualified } from '@/lib/matching/jobQualificationLog';
import { rankJobsWithAI, CandidateProfile } from '@/lib/matching/rankJobsWithAI';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Verify cron secret for security
function verifyCronSecret(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.warn('[Match Jobs Cron] CRON_SECRET not set');
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

    console.log('[Match Jobs Cron] Starting job qualification for all candidates...');

    // Get all active candidates with complete profiles
    const { data: candidates, error: candidatesError } = await supabase
      .from('profiles')
      .select('*')
      .not('skills', 'is', null)
      .not('title', 'is', null);

    if (candidatesError || !candidates) {
      console.error('[Match Jobs Cron] Error fetching candidates:', candidatesError);
      return NextResponse.json({ 
        error: 'Failed to fetch candidates',
        details: candidatesError?.message 
      }, { status: 500 });
    }

    console.log(`[Match Jobs Cron] Processing ${candidates.length} candidates`);

    let totalNewJobs = 0;
    let totalSkipped = 0;
    let candidatesProcessed = 0;
    const errors: string[] = [];

    for (const profile of candidates) {
      try {
        // Get existing job IDs for this candidate (NEVER re-insert)
        const { data: existingMatches } = await supabase
          .from('candidate_job_matches')
          .select('job_id')
          .eq('candidate_id', profile.id);
        
        const existingJobIds = new Set((existingMatches || []).map(m => m.job_id));

        // Fetch and match jobs
        const matchingResult = await fetchAndMatchJobs(supabase, profile, {
          minScore: 50, // 50 out of 80 points threshold
          logFiltering: false, // Quiet mode for cron
        });

        // Filter to ONLY NEW jobs
        const newJobs = matchingResult.eligible.filter(job => 
          job.id && !existingJobIds.has(job.id)
        );

        // Insert new jobs only
        for (const job of newJobs) {
          if (!job.id) continue;

          const matchData = {
            candidate_id: profile.id,
            job_id: job.id,
            match_score: job.match_score,
            match_source: job.match_source || 'global_match',
            qualified_at: new Date().toISOString(),
            reasons: job.score_breakdown ? [
              `Skills: ${job.score_breakdown.skills} points`,
              `Experience: ${job.score_breakdown.experience} points`,
              `Degree/Cert: ${job.score_breakdown.degree} points`,
              `Pay Rate: ${job.score_breakdown.pay} points`,
            ].filter(Boolean) : [],
          };

          const { error: insertError } = await supabase
            .from('candidate_job_matches')
            .insert(matchData);

          if (insertError) {
            if (insertError.code === '23505') {
              totalSkipped++;
              continue;
            }
            console.error(`[Match Jobs Cron] Insert error for ${profile.id}:`, insertError);
            continue;
          }

          totalNewJobs++;

          // Log qualification
          await logJobQualified(
            profile.id,
            job.id,
            matchData.match_source as 'explicit_target' | 'global_match',
            job.match_score,
            'Cron job qualification'
          );
        }

        candidatesProcessed++;
      } catch (err: any) {
        errors.push(`${profile.id}: ${err.message}`);
      }
    }

    console.log(`[Match Jobs Cron] Matching complete: ${totalNewJobs} new jobs qualified, ${totalSkipped} skipped`);

    // ============================================
    // PHASE 2: AI RANKING (runs after matching)
    // ============================================
    // Rank candidates who:
    // 1. Got new jobs in this run, OR
    // 2. Have never been ranked (last_ranked_at IS NULL), OR
    // 3. Haven't been ranked in 24+ hours (safety net)
    // This ensures no candidate remains unranked
    
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const twentyFourHoursAgoStr = twentyFourHoursAgo.toISOString();
    
    const candidatesNeedingRanking = new Set<string>();
    
    // Track which candidates need ranking
    for (const profile of candidates) {
      // Check if candidate has active jobs
      const { data: activeMatches } = await supabase
        .from('candidate_job_matches')
        .select('last_ranked_at, qualified_at')
        .eq('candidate_id', profile.id)
        .is('applied_at', null)
        .is('dismissed_at', null)
        .limit(1);

      if (!activeMatches || activeMatches.length === 0) {
        continue; // No active jobs, skip
      }

      // Check if ranking is needed:
      // - Never ranked (last_ranked_at IS NULL), OR
      // - Stale ranking (last_ranked_at < 24 hours ago), OR
      // - Got new jobs in this run (qualified_at in last hour)
      const needsRanking = activeMatches.some((match: any) => {
        const neverRanked = !match.last_ranked_at;
        const staleRanking = match.last_ranked_at && match.last_ranked_at < twentyFourHoursAgoStr;
        const newJobs = match.qualified_at && match.qualified_at > new Date(Date.now() - 60 * 60 * 1000).toISOString();
        return neverRanked || staleRanking || newJobs;
      });

      if (needsRanking) {
        candidatesNeedingRanking.add(profile.id);
      }
    }

    let candidatesRanked = 0;
    let jobsRanked = 0;

    if (candidatesNeedingRanking.size > 0) {
      console.log(`[Match Jobs Cron] Running AI ranking for ${candidatesNeedingRanking.size} candidates (new jobs, unranked, or stale rankings)...`);

      for (const candidateId of candidatesNeedingRanking) {
        try {
          const profile = candidates.find(p => p.id === candidateId);
          if (!profile) continue;

          const candidateData: CandidateProfile = {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            title: profile.title,
            location: profile.location,
            phone: profile.phone,
            skills: profile.skills,
            primary_skills: profile.primary_skills,
            secondary_skills: profile.secondary_skills,
            adjacent_skills: profile.adjacent_skills,
            generic_skills: profile.generic_skills,
            experience_years: profile.experience_years,
            preferred_job_types: profile.preferred_job_types,
            rate_expectation: profile.rate_expectation,
            expected_pay_min: profile.expected_pay_min,
            work_mode: profile.work_mode,
            contract_type: profile.contract_type,
            visa_status: profile.visa_status,
            availability: profile.availability,
            summary: profile.summary,
            resume_text: profile.resume_text,
            degrees: profile.degrees,
            certifications: profile.certifications,
          };

          const rankingResult = await rankJobsWithAI(profile.id, candidateData);
          jobsRanked += rankingResult.jobs.length;
          candidatesRanked++;

          console.log(`[Match Jobs Cron] Ranked ${rankingResult.jobs.length} jobs for ${profile.id.substring(0, 8)}...`);
        } catch (rankError: any) {
          console.error(`[Match Jobs Cron] Ranking error for ${candidateId}:`, rankError.message);
          errors.push(`Ranking ${candidateId}: ${rankError.message}`);
        }
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[Match Jobs Cron] Completed in ${duration}ms`);
    console.log(`[Match Jobs Cron] Summary: ${totalNewJobs} jobs qualified, ${candidatesRanked} candidates ranked, ${jobsRanked} jobs prioritized`);

    return NextResponse.json({
      success: true,
      matching: {
        candidatesProcessed,
        newJobsQualified: totalNewJobs,
        skipped: totalSkipped,
      },
      ranking: {
        candidatesRanked,
        jobsRanked,
      },
      errors: errors.length > 0 ? errors : undefined,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Match Jobs Cron] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

