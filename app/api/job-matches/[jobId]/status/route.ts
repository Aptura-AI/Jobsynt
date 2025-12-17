/**
 * Update Job Match Status API
 * 
 * Allows candidates to update job status (applied, dismissed, etc.)
 * This gives AI memory and prevents resurfacing unwanted jobs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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
    const { status } = await req.json();

    // Validate status
    const validStatuses = ['active', 'applied', 'dismissed', 'expired'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
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

    // Update job status
    const { data: updatedMatch, error: updateError } = await supabase
      .from('candidate_job_matches')
      .update({ 
        job_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('candidate_id', profile.id)
      .eq('job_id', jobId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating job status:', updateError);
      return NextResponse.json({ 
        error: updateError.message || 'Failed to update job status' 
      }, { status: 500 });
    }

    if (!updatedMatch) {
      return NextResponse.json({ 
        error: 'Job match not found' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Job status updated to ${status}`,
      match: updatedMatch,
    });
  } catch (error: any) {
    console.error('Update job status error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

