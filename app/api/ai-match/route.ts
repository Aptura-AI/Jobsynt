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

    // Get profile with all fields including resume_text
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile_id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Ensure resume_text is populated (fetch from resumes table if missing in profile)
    if (!profile.resume_text) {
      const { data: resumeRow } = await supabase
        .from('resumes')
        .select('extracted_text')
        .eq('profile_id', profile.id)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (resumeRow?.extracted_text) {
        // Update profile with resume_text for future use
        await supabase
          .from('profiles')
          .update({ resume_text: resumeRow.extracted_text })
          .eq('id', profile.id);
        
        profile.resume_text = resumeRow.extracted_text;
      }
    }

    // STEP 1: Fetch jobs from candidate_job_matches (deterministic matching already done)
    // AI receives ONLY jobs from candidate_job_matches table
    const { data: matches, error: matchesError } = await supabase
      .from('candidate_job_matches')
      .select(`
        job_id,
        match_score,
        reasons,
        scraped_jobs (
          id,
          title,
          company,
          location,
          job_type,
          description,
          salary,
          pay_rate_min,
          pay_rate_max,
          required_years_experience,
          skills
        )
      `)
      .eq('candidate_id', profile.id)
      .order('match_score', { ascending: false })
      .limit(50);

    if (matchesError || !matches || matches.length === 0) {
      return NextResponse.json({
        matched: 0,
        message: 'No matched jobs found in candidate_job_matches. Run deterministic matching first.',
      });
    }

    // STEP 2: Pass matched jobs to AI for review and ranking
    // AI must not re-score or filter - these jobs are already validated (score ≥70%)
    let matchedCount = 0;
    const aiProcessedJobs: Array<{ jobId: string; matchScore: number; aiConfirmed: boolean }> = [];

    for (const match of matches) {
      // Handle both array and object types from Supabase join
      const jobData = match.scraped_jobs;
      const job = Array.isArray(jobData) ? jobData[0] : jobData;
      if (!job || !job.id) {
        continue;
      }

      // Convert to EligibleJob format for AI review
      const eligibleJob = {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        job_type: job.job_type,
        description: job.description,
        salary: job.salary,
        match_score: match.match_score,
        score_breakdown: {
          skills: 0, // Will be extracted from reasons if available
          jobTitle: 0,
          experience: 0,
          degree: 0,
          pay: 0,
          total: match.match_score,
        },
      };
      // Skip jobs without ID (required for saving matched jobs)
      if (!eligibleJob.id) {
        console.warn(`Skipping job without ID: ${eligibleJob.title} at ${eligibleJob.company}`);
        continue;
      }

      try {
        // Review job with AI (using Responses API or fallback)
        // Type assertion: we've verified id exists above, so we can safely cast
        const aiReview = await reviewJobWithAI(eligibleJob as import('@/lib/matching/aiJobReview').EligibleJob, profile);

        if (aiReview.confirmed) {
          // Update candidate_job_matches with AI insights
          const updatedReasons = [
            ...(Array.isArray(match.reasons) ? match.reasons : []),
            ...(aiReview.advice || []).slice(0, 3), // Include top 3 AI advice items
          ];

          const { error: updateError } = await supabase
            .from('candidate_job_matches')
            .update({
              reasons: updatedReasons,
              updated_at: new Date().toISOString(),
            })
            .eq('candidate_id', profile.id)
            .eq('job_id', eligibleJob.id);

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
      message: `Reviewed ${matchedCount} jobs from candidate_job_matches (AI confirmed matches)`,
      stats: {
        totalFromMatches: matches.length,
        aiProcessed: aiProcessedJobs.length,
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

