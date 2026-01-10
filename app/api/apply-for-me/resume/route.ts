import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';
import { processPendingApplications } from '@/lib/applyForMe/orchestrator';
import { checkInterventionResolved } from '@/lib/applyForMe/collaborativeFlow';
import type { Page } from 'playwright';

// Lazy Playwright import (runtime only)
async function getPlaywright() {
  const pw = await import('playwright');
  return pw;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * POST /api/apply-for-me/resume
 * 
 * Resumes a paused application after human intervention.
 * 
 * Request body:
 * {
 *   applicationRunId: string
 *   resumeToken?: string (optional, for security)
 * }
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

    const { applicationRunId, resumeToken } = await req.json();

    if (!applicationRunId) {
      return NextResponse.json({ error: 'applicationRunId is required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get application run
    const { data: run, error: runError } = await supabase
      .from('job_application_runs')
      .select('id, candidate_id, job_id, job_url, status, intervention_reason, resume_token')
      .eq('id', applicationRunId)
      .maybeSingle();

    if (runError) {
      return NextResponse.json({ error: 'Application run not found' }, { status: 404 });
    }

    if (!run) {
      return NextResponse.json(
        { error: 'Application run not found' },
        { status: 404 }
      );
    }

    if (!run.job_id) {
      return NextResponse.json(
        { error: 'Job ID missing for application run' },
        { status: 400 }
      );
    }

    // Verify candidate owns this run
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', run.candidate_id)
      .eq('email', session.user.email)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify status is WAITING_FOR_CANDIDATE
    if (run.status !== 'WAITING_FOR_CANDIDATE') {
      return NextResponse.json({ 
        error: `Application is not paused. Current status: ${run.status}` 
      }, { status: 400 });
    }

    // Verify resume token if provided
    if (resumeToken && run.resume_token !== resumeToken) {
      return NextResponse.json({ error: 'Invalid resume token' }, { status: 403 });
    }

    // REQUIREMENT 3: Resume validation - ALWAYS validate before resuming
    const { data: jobData } = await supabase
      .from('scraped_jobs')
      .select('url')
      .eq('id', run.job_id)
      .maybeSingle();

    if (!jobData?.url) {
      return NextResponse.json({ 
        error: 'Job URL not found' 
      }, { status: 404 });
    }

    // Validate intervention is resolved (check CAPTCHA/login)
    let page: Page | null = null;
    let validationPassed = false;

    try {
      // Get browser context (reuse if possible)
      const pw = await getPlaywright();
      const headless = process.env.NODE_ENV === 'production';
      const browser = await pw.chromium.launch({ headless, args: ['--no-sandbox'] });
      const context = await browser.newContext();
      page = await context.newPage();

      // Navigate to job URL
      await page.goto(run.job_url, { waitUntil: 'networkidle', timeout: 30000 });

      // Validate based on intervention reason
      const { detectCaptcha, detectLoginRequired, checkInterventionResolved } = await import('@/lib/applyForMe/collaborativeFlow');
      
      if (run.intervention_reason) {
        validationPassed = await checkInterventionResolved(page, run.intervention_reason as any);
      } else {
        // Default validation: check for CAPTCHA and login
        const hasCaptcha = await detectCaptcha(page);
        const needsLogin = await detectLoginRequired(page);
        validationPassed = !hasCaptcha && !needsLogin;
      }

      await browser.close();
    } catch (validationError: any) {
      console.error('[Resume] Validation error:', validationError);
      // If validation fails, stay paused
      validationPassed = false;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          // Ignore
        }
      }
    }

    // If validation failed, stay paused and re-emit instructions
    if (!validationPassed) {
      const { data: job } = await supabase
        .from('scraped_jobs')
        .select('title, company')
        .eq('id', run.job_id)
        .maybeSingle();

      await supabase
        .from('job_application_runs')
        .update({
          intervention_message: 'Please complete the step shown in the open browser window. Once done, return here to continue.',
        })
        .eq('id', applicationRunId);

      return NextResponse.json({
        error: 'VALIDATION_FAILED',
        message: 'The required step has not been completed yet. Please complete it in the browser window and try again.',
      }, { status: 400 });
    }

    // Validation passed - update status back to running
    const { error: updateError } = await supabase
      .from('job_application_runs')
      .update({
        status: 'running',
        intervention_reason: null,
        intervention_message: null,
        paused_at: null,
      })
      .eq('id', applicationRunId);

    if (updateError) {
      console.error('[Resume] Failed to update status:', updateError);
      return NextResponse.json({ error: 'Failed to resume application' }, { status: 500 });
    }

    // Trigger processing (will resume from where it paused)
    processPendingApplications(run.candidate_id).catch(err => {
      console.error('[Resume] Background processing error:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'Application resumed successfully',
    });
  } catch (error: any) {
    console.error('[Resume] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

