/**
 * Cleanup Job Matches Cron
 * 
 * Automatically removes expired and inactive jobs from candidate_job_matches.
 * Runs daily to maintain data quality and prevent AI confusion.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { get30DaysAgoDate } from '@/lib/job-filters';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Verify this is a cron request
function verifyCronRequest(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  if (!process.env.CRON_SECRET) {
    return true; // Allow for local testing
  }
  return false;
}

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const thirtyDaysAgo = get30DaysAgoDate();

    let expiredCount = 0;
    let inactiveCount = 0;

    // Get all active matches with their job details
    const { data: matchesWithJobs } = await supabase
      .from('candidate_job_matches')
      .select(`
        id,
        job_id,
        scraped_jobs!inner(id, is_active, posted_date)
      `)
      .eq('job_status', 'active');

    if (matchesWithJobs) {
      const expiredMatchIds: string[] = [];
      const inactiveMatchIds: string[] = [];
      const cutoffDate = new Date(thirtyDaysAgo);

      matchesWithJobs.forEach((match: any) => {
        const job = match.scraped_jobs;
        
        // Check if job is inactive
        if (job.is_active === false) {
          inactiveMatchIds.push(match.id);
          return;
        }
        
        // Check if job is older than 30 days
        if (job.posted_date) {
          const postedDate = new Date(job.posted_date);
          if (postedDate < cutoffDate) {
            expiredMatchIds.push(match.id);
            return;
          }
        }
      });

      // Mark expired jobs (older than 30 days)
      if (expiredMatchIds.length > 0) {
        const { error: expiredError } = await supabase
          .from('candidate_job_matches')
          .update({ job_status: 'expired' })
          .in('id', expiredMatchIds);

        if (!expiredError) {
          expiredCount = expiredMatchIds.length;
        } else {
          console.error('Error updating expired jobs:', expiredError);
        }
      }

      // Mark inactive jobs (is_active = false)
      if (inactiveMatchIds.length > 0) {
        const { error: inactiveError } = await supabase
          .from('candidate_job_matches')
          .update({ job_status: 'expired' })
          .in('id', inactiveMatchIds);

        if (!inactiveError) {
          inactiveCount = inactiveMatchIds.length;
        } else {
          console.error('Error updating inactive jobs:', inactiveError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Job matches cleanup completed',
      stats: {
        expired: expiredCount,
        inactive: inactiveCount,
        totalCleaned: expiredCount + inactiveCount,
      },
    });
  } catch (error: any) {
    console.error('Cleanup job matches error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

