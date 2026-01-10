import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';
import { hasCandidateAccessServer } from '@/lib/utils/accessCheck';
import { processPendingApplications } from '@/lib/applyForMe/orchestrator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * POST /api/apply-for-me
 * 
 * Initiates automated job applications for selected jobs.
 * 
 * Request body:
 * {
 *   candidateId: string (UUID)
 *   jobIds: string[] (array of job UUIDs)
 * }
 * 
 * Guardrails:
 * - Enforces hasCandidateAccess
 * - Validates resume_json exists
 * - Rate limits per request
 * - Creates job_application_runs records
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { candidateId, jobIds } = await req.json();

    if (!candidateId || !jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json({ 
        error: 'candidateId and jobIds array are required' 
      }, { status: 400 });
    }

    // Rate limit: max 10 jobs per request
    if (jobIds.length > 10) {
      return NextResponse.json({ 
        error: 'Maximum 10 jobs per request' 
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get candidate profile and verify access
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, resume_json')
      .eq('id', candidateId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify email matches session
    if (profile.email !== session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify access (trial/payment check)
    const hasAccess = await hasCandidateAccessServer(profile.id, {
      source: 'api'
    });
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Access denied. Please complete your trial or payment.' 
      }, { status: 403 });
    }

    // Validate resume_json exists
    if (!profile.resume_json) {
      return NextResponse.json({ 
        error: 'Resume not found. Please upload a resume in your profile first.' 
      }, { status: 400 });
    }

    // Fetch job details
    const { data: jobs, error: jobsError } = await supabase
      .from('scraped_jobs')
      .select('id, title, company, url')
      .in('id', jobIds)
      .eq('is_active', true);

    if (jobsError || !jobs || jobs.length === 0) {
      return NextResponse.json({ 
        error: 'No valid jobs found' 
      }, { status: 404 });
    }

    // Create job_application_runs records (all pending initially)
    const applicationRuns = jobs.map(job => ({
      candidate_id: candidateId,
      job_id: job.id,
      job_url: job.url || '',
      status: 'pending',
      error: null,
      applied_at: null,
    }));

    const { data: createdRuns, error: createError } = await supabase
      .from('job_application_runs')
      .insert(applicationRuns)
      .select();

    if (createError || !createdRuns) {
      console.error('[Apply for Me] Failed to create application runs:', createError);
      return NextResponse.json({ 
        error: 'Failed to initialize applications' 
      }, { status: 500 });
    }

    // Trigger background processing (async - don't wait)
    processPendingApplications(candidateId).catch(err => {
      console.error('[Apply for Me] Background processing error:', err);
    });

    return NextResponse.json({
      success: true,
      message: `Started ${createdRuns.length} job application${createdRuns.length > 1 ? 's' : ''}`,
      applicationRuns: createdRuns.map(run => ({
        id: run.id,
        jobId: run.job_id,
        status: run.status,
      })),
    });
  } catch (error: any) {
    console.error('[Apply for Me] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

