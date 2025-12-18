/**
 * MATCHING CRON - Runs at 11:00 AM Daily
 * 
 * LEDGER RULES:
 * - Qualify NEW jobs only
 * - Insert into candidate_job_matches
 * - DO NOT touch existing rows
 * - DO NOT re-score or re-evaluate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchAndMatchJobs } from '@/lib/matching/getEligibleJobs';
import { logJobQualified } from '@/lib/matching/jobQualificationLog';

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
          minScore: 70,
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
              `Job Title: ${job.score_breakdown.jobTitle} points`,
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

    const duration = Date.now() - startTime;

    console.log(`[Match Jobs Cron] Completed in ${duration}ms`);
    console.log(`[Match Jobs Cron] ${totalNewJobs} new jobs qualified, ${totalSkipped} skipped`);

    return NextResponse.json({
      success: true,
      candidatesProcessed,
      newJobsQualified: totalNewJobs,
      skipped: totalSkipped,
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

