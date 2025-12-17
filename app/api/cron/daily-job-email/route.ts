import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendDailyJobDigest } from '@/lib/email';
import { get30DaysAgoDate } from '@/lib/job-filters';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Verify this is a cron request (from Vercel Cron or authorized source)
function verifyCronRequest(req: NextRequest): boolean {
  // Check for Vercel Cron secret header
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  
  // Also allow if CRON_SECRET is not set (for local testing)
  if (!process.env.CRON_SECRET) {
    return true;
  }
  
  return false;
}

/**
 * Daily cron job to send job digest emails at 12:00 PM
 * 
 * This endpoint should be called by:
 * - Vercel Cron: Add to vercel.json
 * - External cron service (cron-job.org, etc.)
 * 
 * Sends AI-shortlisted jobs to all candidates (including pending_auth profiles)
 */
export async function GET(req: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    if (!verifyCronRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all candidate profiles (including pending_auth)
    // Only send to profiles with email and name
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, name, preferred_job_types')
      .eq('role', 'candidate')
      .not('email', 'is', null)
      .not('name', 'is', null);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ 
        message: 'No profiles found',
        emailsSent: 0 
      });
    }

    let emailsSent = 0;
    let emailsFailed = 0;
    const errors: string[] = [];

    // Process each profile
    for (const profile of profiles) {
      try {
        // Get matched jobs for this profile
        // Jobs are matched when profile_id is set and fit_score >= 70 (new matching system threshold)
        // Filter out jobs older than 30 days
        const thirtyDaysAgo = get30DaysAgoDate();
        let jobsQuery = supabase
          .from('scraped_jobs')
          .select('id, title, company, location, job_type, description, url')
          .eq('profile_id', profile.id)
          .gte('fit_score', 70) // Updated to match new matching system threshold
          .eq('is_active', true)
          .gte('posted_date', thirtyDaysAgo); // Only jobs from last 30 days

        // Filter by preferred_job_types if specified
        if (Array.isArray(profile.preferred_job_types) && profile.preferred_job_types.length > 0) {
          jobsQuery = jobsQuery.in('job_type', profile.preferred_job_types);
        }

        const { data: jobs, error: jobsError } = await jobsQuery
          .order('fit_score', { ascending: false })
          .limit(10); // Limit to top 10 jobs per email

        if (jobsError) {
          console.error(`Error fetching jobs for ${profile.email}:`, jobsError);
          errors.push(`${profile.email}: ${jobsError.message}`);
          emailsFailed++;
          continue;
        }

        if (!jobs || jobs.length === 0) {
          // No jobs to send, skip this profile
          continue;
        }

        // Extract skills from description (common tech keywords)
        const extractSkills = (description: string | null): string[] => {
          if (!description) return [];
          const commonSkills = [
            'JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Node.js', 'Angular', 'Vue',
            'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'SQL', 'MongoDB', 'PostgreSQL',
            'CI/CD', 'Git', 'Agile', 'Scrum', 'REST API', 'GraphQL', 'Microservices'
          ];
          const found = commonSkills.filter(skill => 
            description.toLowerCase().includes(skill.toLowerCase())
          );
          return found.slice(0, 5); // Limit to 5 skills
        };

        // Check if we've already sent an email to this candidate today
        const today = new Date().toISOString().split('T')[0];
        const { data: existingEmail } = await supabase
          .from('email_events')
          .select('id')
          .eq('email', profile.email)
          .eq('type', 'daily_matches')
          .gte('sent_at', `${today}T00:00:00Z`)
          .maybeSingle();

        if (existingEmail) {
          // Already sent today, skip (idempotent)
          console.log(`⏭️  Skipping ${profile.email} - already sent today`);
          continue;
        }

        // Send email with tracking
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
          emailsSent++;
          console.log(`✅ Sent job digest to ${profile.email} (${jobs.length} jobs, message_id: ${result.messageId})`);
        } else {
          emailsFailed++;
          errors.push(`${profile.email}: Failed to send email`);
        }
      } catch (error: any) {
        console.error(`Error processing profile ${profile.email}:`, error);
        emailsFailed++;
        errors.push(`${profile.email}: ${error.message}`);
      }
    }

    return NextResponse.json({
      message: 'Daily job email cron completed',
      totalProfiles: profiles.length,
      emailsSent,
      emailsFailed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Daily job email cron error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

// Also support POST for external cron services
export async function POST(req: NextRequest) {
  return GET(req);
}

