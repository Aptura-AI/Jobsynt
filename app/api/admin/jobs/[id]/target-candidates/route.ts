/**
 * Admin Jobs API - Manage Candidate Targeting
 * 
 * POST /api/admin/jobs/[id]/target-candidates - Add candidate UUIDs
 * DELETE /api/admin/jobs/[id]/target-candidates - Remove candidate UUIDs
 * 
 * Admin-only access
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verifyAdmin() {
  const cookieStore = cookies();
  const rawToken = cookieStore.get('jobsynth_token')?.value;
  
  if (!rawToken) {
    return { error: 'Unauthorized', status: 401 };
  }

  const token = verifyToken(rawToken);
  if (!token || token.role !== 'admin') {
    return { error: 'Forbidden - Admin only', status: 403 };
  }

  return { token };
}

function normalizeTargetIds(input: string | string[] | null | undefined): string[] {
  if (!input) return [];
  
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((id: string) => id.trim())
      .filter((id: string) => id.length > 0);
  }
  
  if (Array.isArray(input)) {
    return input
      .map((id: any) => String(id).trim())
      .filter((id: string) => id.length > 0);
  }
  
  return [];
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = verifyAdmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { id } = params;
    const body = await req.json();

    // Get existing job
    const { data: existingJob, error: fetchError } = await supabase
      .from('scraped_jobs')
      .select('target_candidate_ids')
      .eq('id', id)
      .single();

    if (fetchError || !existingJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get new candidate IDs to add
    const newIds = normalizeTargetIds(body.candidate_ids);
    if (newIds.length === 0) {
      return NextResponse.json({ error: 'No candidate IDs provided' }, { status: 400 });
    }

    // Merge with existing (deduplicate)
    const existingIds = existingJob.target_candidate_ids
      ? normalizeTargetIds(existingJob.target_candidate_ids)
      : [];
    
    const mergedIds = Array.from(new Set([...existingIds, ...newIds]));

    // Update job
    const { data: updatedJob, error: updateError } = await supabase
      .from('scraped_jobs')
      .update({ target_candidate_ids: mergedIds.join(',') })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[Admin Jobs] Error updating targeting:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      job: updatedJob,
      added: newIds.length,
      total_targeted: mergedIds.length,
      message: `Added ${newIds.length} candidate(s) to targeting`,
    });
  } catch (error: any) {
    console.error('[Admin Jobs] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = verifyAdmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { id } = params;
    const body = await req.json();

    // Get existing job
    const { data: existingJob, error: fetchError } = await supabase
      .from('scraped_jobs')
      .select('target_candidate_ids')
      .eq('id', id)
      .single();

    if (fetchError || !existingJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get candidate IDs to remove
    const idsToRemove = normalizeTargetIds(body.candidate_ids);
    if (idsToRemove.length === 0) {
      return NextResponse.json({ error: 'No candidate IDs provided' }, { status: 400 });
    }

    // Remove from existing
    const existingIds = existingJob.target_candidate_ids
      ? normalizeTargetIds(existingJob.target_candidate_ids)
      : [];
    
    const remainingIds = existingIds.filter(id => !idsToRemove.includes(id));

    // Update job
    const { data: updatedJob, error: updateError } = await supabase
      .from('scraped_jobs')
      .update({ 
        target_candidate_ids: remainingIds.length > 0 ? remainingIds.join(',') : null 
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[Admin Jobs] Error updating targeting:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      job: updatedJob,
      removed: idsToRemove.length,
      total_targeted: remainingIds.length,
      message: `Removed ${idsToRemove.length} candidate(s) from targeting`,
    });
  } catch (error: any) {
    console.error('[Admin Jobs] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

