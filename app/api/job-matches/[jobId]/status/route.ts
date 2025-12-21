/**
 * Update Job Match Status API (Ledger-Based)
 * 
 * Allows candidates to update job status (applied, dismissed).
 * This is how jobs are "removed" from the active feed.
 * 
 * LEDGER RULES:
 * - Applying sets applied_at = now()
 * - Dismissing sets dismissed_at = now()
 * - Jobs are NEVER deleted, only status-updated
 * - All actions are logged for audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';
import { logJobApplied, logJobDismissed } from '@/lib/matching/jobQualificationLog';
import { logLearningSignal } from '@/lib/matching/learningSignals';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type Action = 'apply' | 'dismiss' | 'restore';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { jobId } = params;
    const body = await req.json();
    const action = body.action as Action;
    const reason = body.reason as string | undefined;

    // Validate action
    const validActions: Action[] = ['apply', 'dismiss', 'restore'];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json({ 
        error: `Invalid action. Must be one of: ${validActions.join(', ')}` 
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get candidate profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', session.user.email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Build update based on action
    const now = new Date().toISOString();
    let updateData: Record<string, any> = {};
    let logFn: (() => Promise<void>) | null = null;

    switch (action) {
      case 'apply':
        updateData = { 
          applied_at: now,
          // Also set job_status for backward compatibility
          job_status: 'applied',
        };
        logFn = () => logJobApplied(profile.id, jobId, reason || 'Candidate applied via dashboard');
        break;

      case 'dismiss':
        updateData = { 
          dismissed_at: now,
          job_status: 'dismissed',
        };
        logFn = () => logJobDismissed(profile.id, jobId, reason || 'Candidate dismissed job');
        break;

      case 'restore':
        // Restore job to active feed
        updateData = { 
          applied_at: null,
          dismissed_at: null,
          job_status: 'active',
        };
        break;
    }

    // Update job match
    const { data: updatedMatch, error: updateError } = await supabase
      .from('candidate_job_matches')
      .update(updateData)
      .eq('candidate_id', profile.id)
      .eq('job_id', jobId)
      .select(`
        job_id,
        match_score,
        match_source,
        ai_priority,
        applied_at,
        dismissed_at,
        qualified_at
      `)
      .single();

    if (updateError) {
      console.error('[Job Status Update] Error:', updateError);
      return NextResponse.json({ 
        error: updateError.message || 'Failed to update job status' 
      }, { status: 500 });
    }

    if (!updatedMatch) {
      return NextResponse.json({ 
        error: 'Job match not found in your recommendations' 
      }, { status: 404 });
    }

    // Log the action
    if (logFn) {
      await logFn();
    }

    // Log learning signal (metadata collection only - no behavior changes)
    if (action === 'apply' || action === 'dismiss') {
      // Fetch job metadata for learning signal
      const { data: jobData } = await supabase
        .from('scraped_jobs')
        .select('uploaded_by, manually_curated, fallback_primary_platform_used')
        .eq('id', jobId)
        .single();

      await logLearningSignal(
        profile.id,
        jobId,
        action,
        {
          match_score: updatedMatch.match_score,
          ai_priority: updatedMatch.ai_priority || undefined,
          match_source: updatedMatch.match_source || undefined,
          job_source: jobData?.uploaded_by || undefined,
          manually_curated: jobData?.manually_curated || false,
          fallback_primary_platform_used: jobData?.fallback_primary_platform_used || false,
        }
      );
    }

    console.log(`[Job Status Update] ${action.toUpperCase()}: candidate=${profile.id.substring(0, 8)}... job=${jobId.substring(0, 8)}...`);

    return NextResponse.json({
      success: true,
      action,
      message: action === 'apply' 
        ? 'Job marked as applied. It will no longer appear in your active feed.'
        : action === 'dismiss'
          ? 'Job dismissed. It will no longer appear in your active feed.'
          : 'Job restored to your active feed.',
      match: updatedMatch,
    });
  } catch (error: any) {
    console.error('[Job Status Update] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
