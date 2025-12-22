/**
 * Admin Candidates API - Get Candidate Profile
 * 
 * GET /api/admin/candidates/[id]
 * - Get full candidate profile with all fields
 * - Admin-only access
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

export async function GET(
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

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*, trial_ends_at, is_paid')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
      }
      console.error('[Admin Candidates] Error fetching profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    console.error('[Admin Candidates] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/candidates/[id]
 * - Extend trial period for a candidate
 * - Admin-only access
 */
export async function PATCH(
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

    const body = await req.json();
    const { days } = body;

    if (!days || typeof days !== 'number' || days <= 0) {
      return NextResponse.json({ error: 'Invalid days value' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { id } = params;

    // First, get current profile to check trial_ends_at
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('trial_ends_at, is_paid')
      .eq('id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Guardrails: Don't extend if paid or no trial exists
    if (profile.is_paid === true) {
      return NextResponse.json({ error: 'Cannot extend trial for paid users' }, { status: 400 });
    }

    if (!profile.trial_ends_at) {
      return NextResponse.json({ error: 'No trial exists to extend' }, { status: 400 });
    }

    // Calculate new trial end date
    const currentTrialEnd = new Date(profile.trial_ends_at);
    const newTrialEnd = new Date(currentTrialEnd);
    newTrialEnd.setDate(newTrialEnd.getDate() + days);

    // Update trial_ends_at
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ trial_ends_at: newTrialEnd.toISOString() })
      .eq('id', id)
      .select('trial_ends_at')
      .single();

    if (updateError) {
      console.error('[Admin Candidates] Error extending trial:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      trial_ends_at: updated.trial_ends_at,
      message: `Trial extended by ${days} days` 
    });
  } catch (error: any) {
    console.error('[Admin Candidates] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

