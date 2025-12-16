import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchAndMatchJobs } from '@/lib/matching/getEligibleJobs';
import { reviewJobWithAI } from '@/lib/matching/aiJobReview';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { profile_id } = await req.json();

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile_id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // STEP 1: Use deterministic matching to get eligible jobs (score ≥70)
    const matchingResult = await fetchAndMatchJobs(supabase, profile, {
      minScore: 70,
      limit: 100,
      logFiltering: true,
    });

    if (matchingResult.eligible.length === 0) {
      return NextResponse.json({
        matched: 0,
        message: 'No eligible jobs found (all jobs filtered or scored below 70%)',
        stats: matchingResult.stats,
      });
    }

    // STEP 2: Pass only eligible jobs to AI for final review
    // AI must not re-score or filter - these jobs are already validated
    let matchedCount = 0;
    const aiProcessedJobs: Array<{ jobId: string; matchScore: number; aiConfirmed: boolean }> = [];

    for (const eligibleJob of matchingResult.eligible.slice(0, 50)) { // Limit to 50 for AI processing
      try {
        // Review job with AI (using Responses API or fallback)
        const aiReview = await reviewJobWithAI(eligibleJob, profile);

        if (aiReview.confirmed) {
          // Save matched job to database
          const matchReasons = [
            `Deterministic score: ${eligibleJob.match_score}%`,
            `Skills: ${eligibleJob.score_breakdown.skills}pts`,
            `Experience: ${eligibleJob.score_breakdown.experience}pts`,
            `Pay: ${eligibleJob.score_breakdown.pay}pts`,
            ...(aiReview.advice || []).slice(0, 3), // Include top 3 AI advice items
          ];

          const { error: updateError } = await supabase
            .from('scraped_jobs')
            .update({
              profile_id: profile.id,
              fit_score: eligibleJob.match_score,
              match_reasons: matchReasons,
            })
            .eq('id', eligibleJob.id);

          if (!updateError) {
            matchedCount++;
            aiProcessedJobs.push({
              jobId: String(eligibleJob.id),
              matchScore: eligibleJob.match_score,
              aiConfirmed: true,
            });
          }
        } else {
          // AI did not confirm (rare, but possible)
          aiProcessedJobs.push({
            jobId: String(eligibleJob.id),
            matchScore: eligibleJob.match_score,
            aiConfirmed: false,
          });
        }
      } catch (aiError: any) {
        console.error('AI processing error for job:', eligibleJob.id, aiError);
        // Continue with next job - don't fail entire batch
      }
    }

    return NextResponse.json({
      matched: matchedCount,
      message: `Matched ${matchedCount} jobs (passed hard filters + scoring ≥70% + AI confirmation)`,
      stats: {
        ...matchingResult.stats,
        aiProcessed: aiProcessedJobs.length,
      },
      breakdown: {
        totalJobs: matchingResult.stats.total,
        hardFiltered: matchingResult.stats.filteredOut,
        lowScore: matchingResult.stats.lowScoreRejected,
        eligibleForAI: matchingResult.eligible.length,
        aiConfirmed: matchedCount,
      },
    });
  } catch (error: any) {
    console.error('AI match error:', error);
    return NextResponse.json({ error: error.message || 'Matching failed' }, { status: 500 });
  }
}

// GET endpoint to trigger matching for all profiles
export async function GET(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger matching for each profile (async, don't await)
    for (const profile of profiles || []) {
      fetch(`${req.nextUrl.origin}/api/ai-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profile.id }),
      }).catch(console.error);
    }

    return NextResponse.json({
      message: `Triggered matching for ${profiles?.length || 0} profiles`,
      profiles: profiles?.length || 0,
    });
  } catch (error: any) {
    console.error('Trigger match error:', error);
    return NextResponse.json({ error: error.message || 'Failed to trigger matching' }, { status: 500 });
  }
}

