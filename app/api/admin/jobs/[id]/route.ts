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

    // PART 7: Validation guardrails - validate all admin inputs
    // Basic fields with validation
    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title || title.length === 0) {
        return NextResponse.json({ error: 'Job title is required' }, { status: 400 });
      }
      updateData.title = title;
    }
    if (body.company !== undefined) {
      const company = String(body.company).trim();
      if (!company || company.length === 0) {
        return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
      }
      updateData.company = company;
    }
    if (body.location !== undefined) {
      updateData.location = String(body.location).trim();
    }
    if (body.url !== undefined) {
      const url = String(body.url).trim();
      if (url && !url.match(/^https?:\/\//)) {
        return NextResponse.json({ error: 'Invalid URL format. Must start with http:// or https://' }, { status: 400 });
      }
      updateData.url = url;
    }
    if (body.description !== undefined) {
      updateData.description = String(body.description).trim();
    }
    if (body.job_type !== undefined) {
      const jobType = String(body.job_type).trim();
      const validJobTypes = ['full-time', 'w2-contract', 'c2c', '1099'];
      if (jobType && !validJobTypes.includes(jobType)) {
        return NextResponse.json({ 
          error: `Invalid job type. Must be one of: ${validJobTypes.join(', ')}` 
        }, { status: 400 });
      }
      updateData.job_type = jobType;
    }
    
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

    // Work Location Type (Remote/Hybrid/Onsite) - PART 1
    if (body.work_location_type !== undefined) {
      const workLocationType = String(body.work_location_type).trim();
      if (!['Remote', 'Hybrid', 'Onsite'].includes(workLocationType)) {
        return NextResponse.json({ 
          error: 'Invalid work_location_type. Must be Remote, Hybrid, or Onsite' 
        }, { status: 400 });
      }
      updateData.work_location_type = workLocationType;
      
      // Validation: Hybrid/Onsite require location
      if ((workLocationType === 'Hybrid' || workLocationType === 'Onsite') && !body.location?.trim()) {
        const existingLocation = existingJob.location;
        if (!existingLocation || !existingLocation.trim()) {
          return NextResponse.json({ 
            error: `${workLocationType} jobs require a location. Please provide a location.` 
          }, { status: 400 });
        }
      }
    }
    
    // Location validation
    if (body.location !== undefined) {
      const location = String(body.location).trim();
      const workLocationType = body.work_location_type || existingJob.work_location_type || 'Remote';
      
      // If location is being removed and job is Hybrid/Onsite, error
      if (!location && (workLocationType === 'Hybrid' || workLocationType === 'Onsite')) {
        return NextResponse.json({ 
          error: `${workLocationType} jobs require a location. Cannot remove location.` 
        }, { status: 400 });
      }
      
      updateData.location = location;
    }
    
    // Legacy support (deprecated - use work_location_type instead)
    if (body.is_remote !== undefined) {
      // Convert is_remote to work_location_type
      // If is_remote is explicitly false, set to Onsite (don't preserve existing Remote)
      // If is_remote is true, set to Remote
      // Only use existing value if is_remote is not explicitly set
      updateData.work_location_type = body.is_remote ? 'Remote' : 'Onsite';
    }
    if (body.location_type !== undefined) {
      // Map location_type to work_location_type
      const locationType = String(body.location_type).trim();
      if (['Remote', 'Hybrid', 'Onsite'].includes(locationType)) {
        updateData.work_location_type = locationType;
      }
    }

    // PART 3: Platform MUST come from must_have_skills (source of truth)
    if (body.must_have_skills !== undefined || body.title !== undefined) {
      const title = body.title !== undefined ? body.title : existingJob.title;
      const mustHave = body.must_have_skills !== undefined ? body.must_have_skills : existingJob.must_have_skills;
      const goodToHave = body.good_to_have_skills !== undefined ? body.good_to_have_skills : existingJob.good_to_have_skills;
      
      // Primary platform derived from must_have_skills (open-text approach)
      const mustHaveSkills: string[] = mustHave ? mustHave.split(/[,;|]/).map((s: string) => s.trim()).filter((s: string) => s.length > 0) : [];
      const allSkills: string[] = [
        ...mustHaveSkills,
        ...(goodToHave ? goodToHave.split(/[,;|]/).map((s: string) => s.trim()).filter((s: string) => s.length > 0) : [])
      ];
      
      // Extract platform - use first skill from must_have_skills
      let primaryPlatform = extractPlatformFromJob(title, mustHaveSkills.length > 0 ? mustHaveSkills : allSkills);
      
      // If no platform extracted and we have skills, use first skill
      if (!primaryPlatform && mustHaveSkills.length > 0) {
        const firstSkill = mustHaveSkills[0].trim();
        if (firstSkill) {
          // Normalize to title-case
          primaryPlatform = firstSkill
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
      }
      
      // If still no platform (no skills), default to "General"
      if (!primaryPlatform) {
        primaryPlatform = 'General';
      }
      
      updateData.primary_platform = primaryPlatform;
      updateData.secondary_platforms = extractSecondaryPlatforms(title, allSkills).length > 0 
        ? extractSecondaryPlatforms(title, allSkills) 
        : null;
    } else if (body.primary_platform !== undefined) {
      // Allow manual override, but warn if must_have_skills suggests different platform
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
          .map((id: string) => id.trim())
          .filter((id: string) => id.length > 0);
        updateData.target_candidate_ids = ids.length > 0 ? ids.join(',') : null;
      } else if (Array.isArray(body.target_candidate_ids)) {
        const ids = body.target_candidate_ids
          .map((id: any) => String(id).trim())
          .filter((id: string) => id.length > 0);
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

