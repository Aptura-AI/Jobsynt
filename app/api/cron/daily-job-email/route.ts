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
  const cronName = 'daily-job-email';
  let cronRunId: string | null = null;
  
  try {
    if (!verifyCronRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create cron run tracking record
    const { data: cronRun, error: cronRunError } = await supabase
      .from('cron_runs')
      .insert({
        cron_name: cronName,
        started_at: new Date().toISOString(),
        status: 'success',
        summary: {}
      })
      .select('id')
      .single();

    if (cronRunError) {
      console.error('[Email Cron] Failed to create cron run record:', cronRunError);
    } else {
      cronRunId = cronRun.id;
    }

    console.log('[Email Cron] Starting daily job email distribution...');

    // Get all candidate profiles with email and payment/trial status
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, name, preferred_job_types, daily_email_sent_at, trial_ends_at, is_paid')
      .eq('role', 'candidate')
      .not('email', 'is', null)
      .not('name', 'is', null);

    if (profilesError) {
      console.error('[Email Cron] Error fetching profiles:', profilesError);
      if (cronRunId) {
        await supabase
          .from('cron_runs')
          .update({
            finished_at: new Date().toISOString(),
            status: 'failed',
            summary: { error: profilesError.message }
          })
          .eq('id', cronRunId);
      }
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      console.log('[Email Cron] No candidates — exiting');
      if (cronRunId) {
        await supabase
          .from('cron_runs')
          .update({
            finished_at: new Date().toISOString(),
            status: 'success',
            summary: { candidates_processed: 0, emails_sent: 0, skipped: 0, failures: 0 }
          })
          .eq('id', cronRunId);
      }
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

    // Import centralized access check - no duplicated logic
    const { hasCandidateAccessServer } = await import('@/lib/utils/accessCheck');

    /**
     * Check if trial has expired
     */
    function isTrialExpired(trialEndsAt: string | null | undefined): boolean {
      if (!trialEndsAt) return false;
      const trialEnd = new Date(trialEndsAt);
      const now = new Date();
      return trialEnd <= now;
    }

    for (const profile of profiles) {
      try {
        // PART 1: Email Idempotency Guard - Check daily_email_sent_at
        const todayUTC = new Date().toISOString().split('T')[0];
        if (profile.daily_email_sent_at) {
          const sentDate = new Date(profile.daily_email_sent_at).toISOString().split('T')[0];
          if (sentDate === todayUTC) {
            console.log(`[Email Cron] Skipping ${profile.email} — already sent today`);
            emailsSkipped++;
            continue;
          }
        }

        // Also check email_events as backup (legacy check)
        const { data: existingEmail } = await supabase
          .from('email_events')
          .select('id')
          .eq('candidate_id', profile.id)
          .eq('email_type', 'daily_jobs')
          .gte('sent_at', `${today}T00:00:00Z`)
          .maybeSingle();

        if (existingEmail) {
          console.log(`[Email Cron] Skipping ${profile.email} - already sent today (email_events)`);
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
          .is('dismissed_at', null);   // Not dismissed

        if (jobsError) {
          console.error(`[Email Cron] Error fetching jobs for ${profile.email}:`, jobsError);
          errors.push(`${profile.email}: ${jobsError.message}`);
          emailsFailed++;
          continue;
        }
        
        // Filter by date CLIENT-SIDE to handle NULL posted_date properly
        const filteredMatches = (matches || []).filter((match: any) => {
          const job = match.scraped_jobs;
          if (!job) return false;
          // If posted_date is NULL, treat as recent
          if (!job.posted_date) return true;
          return job.posted_date >= thirtyDaysAgo;
        });

        // Sort by: explicit_target > ai_priority > fit_score
        const sortedMatches = filteredMatches.sort((a: any, b: any) => {
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
          // PART 4: Hard Safety Guard - No eligible jobs
          console.log(`[Email Cron] No eligible jobs — skipping email for ${profile.email}`);
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
          location_type: match.scraped_jobs.work_location_type || match.scraped_jobs.location_type || null,
          description: match.scraped_jobs.description,
          url: match.scraped_jobs.url,
          fit_score: match.match_score,
          match_source: match.match_source,
          ai_priority: match.ai_priority,
          match_reasons: match.reasons || [],
        }));

        // Check access status using centralized function
        const hasAccess = await hasCandidateAccessServer(profile.id, supabase);
        const trialExpired = isTrialExpired(profile.trial_ends_at);

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

        // Determine email content based on access
        let jobsToSend = jobs;
        let isPreview = false;
        let subjectSuffix = '';

        if (!hasAccess) {
          // Preview mode: only top 2 jobs, no links
          jobsToSend = jobs.slice(0, 2);
          isPreview = true;
          
          if (trialExpired) {
            subjectSuffix = ' - Your free trial has ended';
          }
        }

        // Send email
        const result = await sendDailyJobDigest(
          profile.email,
          profile.name || 'Candidate',
          jobsToSend.map(job => ({
            id: job.id,
            title: job.title || 'Untitled',
            company: job.company || 'Company not specified',
            location: job.location || 'Location not specified',
            job_type: job.job_type,
            location_type: job.location_type,
            skills_required: extractSkills(job.description),
            url: job.url || '', // Keep for reference, but email will use internal link
          })),
          profile.id,
          jobsToSend.map(j => j.id).filter(Boolean),
          isPreview, // Preview mode flag
          subjectSuffix // Subject suffix for expired trials
        );

        if (result.success) {
          // PART 1: Update daily_email_sent_at after successful send
          await supabase
            .from('profiles')
            .update({ daily_email_sent_at: new Date().toISOString() })
            .eq('id', profile.id);

          console.log(`[Email Cron] Marked sent_at for ${profile.email}`);

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
          // PART 1: Do NOT update daily_email_sent_at on failure
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

    // PART 2: Update cron run summary
    const status = emailsFailed > 0 && emailsSent === 0 ? 'failed' : (emailsFailed > 0 ? 'partial' : 'success');
    if (cronRunId) {
      await supabase
        .from('cron_runs')
        .update({
          finished_at: new Date().toISOString(),
          status,
          summary: {
            candidates_processed: profiles.length,
            emails_sent: emailsSent,
            skipped: emailsSkipped,
            failures: emailsFailed,
            errors: errors.length > 0 ? errors : undefined
          }
        })
        .eq('id', cronRunId);
    }

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
    
    // PART 2: Mark cron run as failed
    if (cronRunId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase
        .from('cron_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'failed',
          summary: { error: error.message || 'Internal server error' }
        })
        .eq('id', cronRunId);
    }
    
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
