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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * - Update candidate profile fields (all fields except name/email/phone/meta)
 * - Extend trial period (if days provided)
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { id } = params;

    // Check if candidate exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, trial_ends_at, is_paid')
      .eq('id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Handle trial extension (legacy support)
    if (body.days !== undefined) {
      const { days } = body;
      if (!days || typeof days !== 'number' || days <= 0) {
        return NextResponse.json({ error: 'Invalid days value' }, { status: 400 });
      }

      // Guardrails: Don't extend if paid or no trial exists
      if (existingProfile.is_paid === true) {
        return NextResponse.json({ error: 'Cannot extend trial for paid users' }, { status: 400 });
      }

      if (!existingProfile.trial_ends_at) {
        return NextResponse.json({ error: 'No trial exists to extend' }, { status: 400 });
      }

      // Calculate new trial end date
      const currentTrialEnd = new Date(existingProfile.trial_ends_at);
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
    }

    // Handle profile field updates
    // ALLOWED: All fields except name, email, phone, and meta fields (id, created_at, auth_id)
    const updateData: Record<string, unknown> = {};

    // Editable fields
    if (body.location !== undefined) updateData.location = body.location || null;
    if (body.experience_years !== undefined) updateData.experience_years = body.experience_years || null;
    if (body.title !== undefined) updateData.title = body.title || null;
    if (body.summary !== undefined) updateData.summary = body.summary || null;
    if (body.visa_status !== undefined) updateData.visa_status = body.visa_status || null;
    if (body.rate_expectation !== undefined) updateData.rate_expectation = body.rate_expectation || null;
    if (body.expected_pay_min !== undefined) updateData.expected_pay_min = body.expected_pay_min || null;
    
    // Skills arrays
    if (body.primary_skills !== undefined) {
      updateData.primary_skills = Array.isArray(body.primary_skills) ? body.primary_skills : null;
    }
    if (body.secondary_skills !== undefined) {
      updateData.secondary_skills = Array.isArray(body.secondary_skills) ? body.secondary_skills : null;
    }
    if (body.adjacent_skills !== undefined) {
      updateData.adjacent_skills = Array.isArray(body.adjacent_skills) ? body.adjacent_skills : null;
    }
    if (body.generic_skills !== undefined) {
      updateData.generic_skills = Array.isArray(body.generic_skills) ? body.generic_skills : null;
    }
    
    // Platform fields
    if (body.primary_platform !== undefined) updateData.primary_platform = body.primary_platform || null;
    if (body.secondary_platforms !== undefined) {
      updateData.secondary_platforms = Array.isArray(body.secondary_platforms) ? body.secondary_platforms : null;
    }
    
    // Job preferences
    if (body.preferred_job_types !== undefined) {
      updateData.preferred_job_types = Array.isArray(body.preferred_job_types) ? body.preferred_job_types : null;
    }
    if (body.contract_type !== undefined) updateData.contract_type = body.contract_type || null;
    if (body.work_mode !== undefined) updateData.work_mode = body.work_mode || null;
    if (body.availability !== undefined) updateData.availability = body.availability || null;

    // If no update data provided, return error
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Update profile
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[Admin Candidates] Error updating profile:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      profile: updated,
      message: 'Profile updated successfully' 
    });
  } catch (error: unknown) {
    console.error('[Admin Candidates] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

