import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
 * Daily cron job to delete jobs older than 30 days
 * 
 * This endpoint should be called by:
 * - Vercel Cron: Add to vercel.json
 * - External cron service (cron-job.org, etc.)
 * 
 * Deletes jobs from scraped_jobs table where posted_date is older than 30 days
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

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format

    // First, count how many jobs will be deleted
    const { count, error: countError } = await supabase
      .from('scraped_jobs')
      .select('*', { count: 'exact', head: true })
      .lt('posted_date', cutoffDate);

    if (countError) {
      console.error('Error counting old jobs:', countError);
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const jobsToDelete = count || 0;

    if (jobsToDelete === 0) {
      return NextResponse.json({
        message: 'No old jobs to delete',
        deleted: 0,
        cutoffDate,
      });
    }

    // Delete jobs older than 30 days
    const { error: deleteError } = await supabase
      .from('scraped_jobs')
      .delete()
      .lt('posted_date', cutoffDate);

    if (deleteError) {
      console.error('Error deleting old jobs:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log(`✅ Deleted ${jobsToDelete} jobs older than 30 days (cutoff: ${cutoffDate})`);

    return NextResponse.json({
      message: 'Old jobs cleanup completed',
      deleted: jobsToDelete,
      cutoffDate,
    });
  } catch (error: any) {
    console.error('Cleanup old jobs cron error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

// Also support POST for external cron services
export async function POST(req: NextRequest) {
  return GET(req);
}

