/**
 * Admin Jobs API - Get/Update Single Job
 * 
 * GET /api/admin/jobs/[id] - Get single job
 * PATCH /api/admin/jobs/[id] - Update job fields
 * 
 * Admin-only access
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import { createClient } from '@supabase/supabase-js';
import { extractPlatformFromJob, extractSecondaryPlatforms } from '@/lib/matching/extractPlatform';

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

    const { data: job, error } = await supabase
      .from('scraped_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      console.error('[Admin Jobs] Error fetching job:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(job);
  } catch (error: any) {
    console.error('[Admin Jobs] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { id } = params;
    const body = await req.json();

    // Get existing job to merge with
    const { data: existingJob, error: fetchError } = await supabase
      .from('scraped_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Prepare update data (only include fields that are provided)
    const updateData: any = {};

    // Basic fields
    if (body.title !== undefined) updateData.title = String(body.title).trim();
    if (body.company !== undefined) updateData.company = String(body.company).trim();
    if (body.location !== undefined) updateData.location = String(body.location).trim();
    if (body.url !== undefined) updateData.url = String(body.url).trim();
    if (body.description !== undefined) updateData.description = String(body.description).trim();
    if (body.job_type !== undefined) updateData.job_type = String(body.job_type).trim();
    
    // Skills
    if (body.must_have_skills !== undefined) {
      updateData.must_have_skills = String(body.must_have_skills).trim() || '';
    }
    if (body.good_to_have_skills !== undefined) {
      updateData.good_to_have_skills = String(body.good_to_have_skills).trim() || '';
    }

    // Experience and salary
    if (body.required_years_experience !== undefined) {
      updateData.required_years_experience = parseInt(String(body.required_years_experience), 10) || 0;
    }
    if (body.salary !== undefined) {
      updateData.salary = body.salary ? String(body.salary).trim() : null;
      updateData.pay_rate_raw = body.salary ? String(body.salary).trim() : null;
    }

    // Location
    if (body.is_remote !== undefined) {
      updateData.is_remote = Boolean(body.is_remote);
    }
    if (body.location_type !== undefined) {
      updateData.location_type = String(body.location_type).trim();
    }

    // Platform (re-extract if title or skills changed)
    if (body.title !== undefined || body.must_have_skills !== undefined || body.good_to_have_skills !== undefined) {
      const title = body.title !== undefined ? body.title : existingJob.title;
      const mustHave = body.must_have_skills !== undefined ? body.must_have_skills : existingJob.must_have_skills;
      const goodToHave = body.good_to_have_skills !== undefined ? body.good_to_have_skills : existingJob.good_to_have_skills;
      
      const allSkills = [
        ...(mustHave ? mustHave.split(/[,;|]/).map(s => s.trim()) : []),
        ...(goodToHave ? goodToHave.split(/[,;|]/).map(s => s.trim()) : [])
      ];
      
      const primaryPlatform = extractPlatformFromJob(title, allSkills);
      const secondaryPlatforms = extractSecondaryPlatforms(title, allSkills);
      
      updateData.primary_platform = primaryPlatform || null;
      updateData.secondary_platforms = secondaryPlatforms.length > 0 ? secondaryPlatforms : null;
    } else if (body.primary_platform !== undefined) {
      updateData.primary_platform = body.primary_platform ? String(body.primary_platform).trim() : null;
    }
    if (body.secondary_platforms !== undefined) {
      updateData.secondary_platforms = Array.isArray(body.secondary_platforms) && body.secondary_platforms.length > 0
        ? body.secondary_platforms
        : null;
    }

    // Targeting
    if (body.target_candidate_ids !== undefined) {
      // Accept string (comma-separated) or array
      if (typeof body.target_candidate_ids === 'string') {
        const ids = body.target_candidate_ids
          .split(',')
          .map(id => id.trim())
          .filter(id => id.length > 0);
        updateData.target_candidate_ids = ids.length > 0 ? ids.join(',') : null;
      } else if (Array.isArray(body.target_candidate_ids)) {
        const ids = body.target_candidate_ids
          .map(id => String(id).trim())
          .filter(id => id.length > 0);
        updateData.target_candidate_ids = ids.length > 0 ? ids.join(',') : null;
      } else {
        updateData.target_candidate_ids = null;
      }
    }

    // Status
    if (body.is_active !== undefined) {
      updateData.is_active = Boolean(body.is_active);
    }
    if (body.is_real !== undefined) {
      updateData.is_real = Boolean(body.is_real);
    }

    // Dates
    if (body.posted_date !== undefined) {
      updateData.posted_date = String(body.posted_date).trim();
    }

    // Update job
    const { data: updatedJob, error: updateError } = await supabase
      .from('scraped_jobs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[Admin Jobs] Error updating job:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      job: updatedJob,
      message: 'Job updated successfully',
    });
  } catch (error: any) {
    console.error('[Admin Jobs] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

