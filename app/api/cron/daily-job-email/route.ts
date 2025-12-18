/**
 * EMAIL CRON - Runs at 12:00 PM Daily
 * 
 * LEDGER RULES:
 * - Email ONLY if candidate has ≥1 active job
 * - Include top 3-5 jobs ordered by: explicit_target > ai_priority > fit_score
 * - Include tracking pixel
 * - Mark email sent in email_events
 * - Do NOT re-trigger AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendDailyJobDigest } from '@/lib/email';
import { get30DaysAgoDate } from '@/lib/job-filters';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Verify this is a cron request (from Vercel Cron or authorized source)
function verifyCronRequest(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  
  if (!process.env.CRON_SECRET) {
    return true; // Allow in development
  }
  
  return false;
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    if (!verifyCronRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[Email Cron] Starting daily job email distribution...');

    // Get all candidate profiles with email
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, name, preferred_job_types')
      .eq('role', 'candidate')
      .not('email', 'is', null)
      .not('name', 'is', null);

    if (profilesError) {
      console.error('[Email Cron] Error fetching profiles:', profilesError);
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ 
        message: 'No profiles found',
        emailsSent: 0 
      });
    }

    let emailsSent = 0;
    let emailsSkipped = 0;
    let emailsFailed = 0;
    const errors: string[] = [];

    const thirtyDaysAgo = get30DaysAgoDate();
    const today = new Date().toISOString().split('T')[0];

    for (const profile of profiles) {
      try {
        // Check if already sent today (idempotent)
        const { data: existingEmail } = await supabase
          .from('email_events')
          .select('id')
          .eq('candidate_id', profile.id)
          .eq('email_type', 'daily_jobs')
          .gte('sent_at', `${today}T00:00:00Z`)
          .maybeSingle();

        if (existingEmail) {
          console.log(`[Email Cron] Skipping ${profile.email} - already sent today`);
          emailsSkipped++;
          continue;
        }

        // LEDGER QUERY: Get active jobs from candidate_job_matches
        // Order: explicit_target > ai_priority > fit_score
        const { data: matches, error: jobsError } = await supabase
          .from('candidate_job_matches')
          .select(`
            job_id,
            match_score,
            match_source,
            ai_priority,
            reasons,
            scraped_jobs!inner (
              id,
              title,
              company,
              location,
              job_type,
              description,
              url,
              posted_date
            )
          `)
          .eq('candidate_id', profile.id)
          .is('applied_at', null)      // Not applied
          .is('dismissed_at', null)    // Not dismissed
          .gte('scraped_jobs.posted_date', thirtyDaysAgo);

        if (jobsError) {
          console.error(`[Email Cron] Error fetching jobs for ${profile.email}:`, jobsError);
          errors.push(`${profile.email}: ${jobsError.message}`);
          emailsFailed++;
          continue;
        }

        // Sort by: explicit_target > ai_priority > fit_score
        const sortedMatches = (matches || []).sort((a: any, b: any) => {
          // 1. Explicit targets first
          if (a.match_source === 'explicit_target' && b.match_source !== 'explicit_target') return -1;
          if (b.match_source === 'explicit_target' && a.match_source !== 'explicit_target') return 1;
          
          // 2. AI priority
          const priorityOrder: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
          const aPriority = priorityOrder[a.ai_priority] || 0;
          const bPriority = priorityOrder[b.ai_priority] || 0;
          if (aPriority !== bPriority) return bPriority - aPriority;
          
          // 3. Fit score
          return (b.match_score || 0) - (a.match_score || 0);
        }).slice(0, 5); // Top 5 jobs

        if (sortedMatches.length === 0) {
          // No active jobs, skip
          console.log(`[Email Cron] Skipping ${profile.email} - no active jobs`);
          emailsSkipped++;
          continue;
        }

        // Transform to job format
        const jobs = sortedMatches.map((match: any) => ({
          id: match.scraped_jobs.id,
          title: match.scraped_jobs.title,
          company: match.scraped_jobs.company,
          location: match.scraped_jobs.location,
          job_type: match.scraped_jobs.job_type,
          description: match.scraped_jobs.description,
          url: match.scraped_jobs.url,
          fit_score: match.match_score,
          match_source: match.match_source,
          ai_priority: match.ai_priority,
          match_reasons: match.reasons || [],
        }));

        // Extract skills from description
        const extractSkills = (description: string | null): string[] => {
          if (!description) return [];
          const commonSkills = [
            'JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Node.js', 'Angular', 'Vue',
            'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'SQL', 'MongoDB', 'PostgreSQL',
            'CI/CD', 'Git', 'Agile', 'Scrum', 'REST API', 'GraphQL', 'Microservices'
          ];
          return commonSkills.filter(skill => 
            description.toLowerCase().includes(skill.toLowerCase())
          ).slice(0, 5);
        };

        // Send email
        const result = await sendDailyJobDigest(
          profile.email,
          profile.name || 'Candidate',
          jobs.map(job => ({
            title: job.title || 'Untitled',
            company: job.company || 'Company not specified',
            location: job.location || 'Location not specified',
            job_type: job.job_type,
            skills_required: extractSkills(job.description),
            url: job.url || '',
          })),
          profile.id,
          jobs.map(j => j.id).filter(Boolean)
        );

        if (result.success) {
          // Record email event in ledger
          await supabase
            .from('email_events')
            .insert({
              candidate_id: profile.id,
              email_type: 'daily_jobs',
              job_ids: jobs.map(j => j.id).filter(Boolean),
              metadata: {
                jobs_count: jobs.length,
                explicit_targets: jobs.filter(j => j.match_source === 'explicit_target').length,
                message_id: result.messageId,
              }
            });

          emailsSent++;
          console.log(`[Email Cron] ✅ Sent to ${profile.email} (${jobs.length} jobs)`);
        } else {
          emailsFailed++;
          errors.push(`${profile.email}: Failed to send email`);
        }
      } catch (error: any) {
        console.error(`[Email Cron] Error processing ${profile.email}:`, error);
        emailsFailed++;
        errors.push(`${profile.email}: ${error.message}`);
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[Email Cron] Completed in ${duration}ms`);
    console.log(`[Email Cron] Sent: ${emailsSent}, Skipped: ${emailsSkipped}, Failed: ${emailsFailed}`);

    return NextResponse.json({
      success: true,
      totalProfiles: profiles.length,
      emailsSent,
      emailsSkipped,
      emailsFailed,
      errors: errors.length > 0 ? errors : undefined,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Email Cron] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
