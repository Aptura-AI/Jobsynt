import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { ALLOWED_JOB_TYPES } from '@/lib/job-types';
import { get30DaysAgoDate } from '@/lib/job-filters';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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

    // Get all active jobs from scraped_jobs
    // Filter out jobs older than 30 days
    const thirtyDaysAgo = get30DaysAgoDate();
    let jobsQuery = supabase
      .from('scraped_jobs')
      .select('*')
      .eq('is_active', true)
      .gte('posted_date', thirtyDaysAgo); // Only jobs from last 30 days
    
    // Apply job type filtering if candidate has preferences
    if (Array.isArray(profile.preferred_job_types) && profile.preferred_job_types.length > 0) {
      // Only match jobs where job_type matches one of the preferred types
      jobsQuery = jobsQuery.in('job_type', profile.preferred_job_types);
    }
    
    const { data: jobs, error: jobsError } = await jobsQuery.limit(100);

    if (jobsError) {
      return NextResponse.json({ error: jobsError.message }, { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ matched: 0, message: 'No jobs to match' });
    }

    // Match jobs using AI
    let matchedCount = 0;
    for (const job of jobs.slice(0, 50)) { // Limit to 50 for AI processing
      try {
        const matchPrompt = `Rate this job match for a candidate with:
Skills: ${(profile.skills || []).join(', ') || 'None'}
Experience: ${profile.experience_years || 0} years
Work Mode Preference: ${(profile.work_mode || []).join(', ') || 'Any'}
Contract Type Preference: ${(profile.contract_type || []).join(', ') || 'Any'}
Location: ${profile.location || 'Any'}
Rate Expectation: ${profile.rate_expectation || 'Not specified'}

Job Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${(job.description || '').substring(0, 500)}
Salary: ${job.salary || 'Not specified'}

Return JSON: {"fitScore": 0-100, "matchReasons": ["reason1", "reason2"]}`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 200,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You are a job matching expert. Rate job matches 0-100 based on skills, experience, preferences, and contract type (C2C/1099 focus).' },
            { role: 'user', content: matchPrompt },
          ],
        });

        const matchResult = JSON.parse(completion.choices[0]?.message?.content || '{}');
        const fitScore = matchResult.fitScore || 0;

        // Only save 90%+ matches
        if (fitScore >= 90) {
          const { error: updateError } = await supabase
            .from('scraped_jobs')
            .update({
              profile_id: profile.id,
              fit_score: fitScore,
              match_reasons: matchResult.matchReasons || [],
            })
            .eq('id', job.id);

          if (!updateError) {
            matchedCount++;
          }
        }
      } catch (aiError) {
        console.error('AI matching error for job:', job.id, aiError);
        // Continue with next job
      }
    }

    return NextResponse.json({
      matched: matchedCount,
      message: `Matched ${matchedCount} jobs (90%+ fit)`,
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

