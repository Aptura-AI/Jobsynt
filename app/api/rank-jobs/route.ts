/**
 * AI Job Ranking API
 * 
 * Uses OpenAI Responses API (prompt v3) to rank and curate matched jobs.
 * The AI acts as a recruiter agent, taking charge of job prioritization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';
import { rankJobsWithAI, CandidateProfile } from '@/lib/matching/rankJobsWithAI';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    // Allow manual re-ranking via candidateId parameter (for admin/emergency use)
    // OR use session email (for candidate self-service)
    let candidateId: string | null = null;
    let candidateEmail: string | null = null;

    const body = await req.json().catch(() => ({}));
    candidateId = body.candidateId || null;

    // If candidateId not provided, use session
    if (!candidateId) {
      const session = await getServerSession();
      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      candidateEmail = session.user.email;
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get candidate profile with all fields
    let profile;
    if (candidateId) {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', candidateId)
        .maybeSingle();
      
      if (profileError || !data) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }
      profile = data;
    } else if (candidateEmail) {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', candidateEmail)
        .maybeSingle();

      if (profileError || !data) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }
      profile = data;
    } else {
      return NextResponse.json({ error: 'Candidate ID or session required' }, { status: 400 });
    }

    // Ensure resume_text is populated
    if (!profile.resume_text) {
      const { data: resumeRow } = await supabase
        .from('resumes')
        .select('extracted_text')
        .eq('profile_id', profile.id)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (resumeRow?.extracted_text) {
        await supabase
          .from('profiles')
          .update({ resume_text: resumeRow.extracted_text })
          .eq('id', profile.id);
        
        profile.resume_text = resumeRow.extracted_text;
      }
    }

    // Prepare candidate profile for AI (with all structured skills)
    const candidateData: CandidateProfile = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      title: profile.title,
      location: profile.location,
      phone: profile.phone,
      skills: profile.skills,
      primary_skills: profile.primary_skills,
      secondary_skills: profile.secondary_skills,
      adjacent_skills: profile.adjacent_skills,
      generic_skills: profile.generic_skills,
      experience_years: profile.experience_years,
      preferred_job_types: profile.preferred_job_types,
      rate_expectation: profile.rate_expectation,
      expected_pay_min: profile.expected_pay_min,
      work_mode: profile.work_mode,
      contract_type: profile.contract_type,
      visa_status: profile.visa_status,
      availability: profile.availability,
      summary: profile.summary,
      resume_text: profile.resume_text,
      degrees: profile.degrees,
      certifications: profile.certifications,
    };

    // Rank jobs using AI
    const rankingResult = await rankJobsWithAI(profile.id, candidateData);

    return NextResponse.json({
      success: true,
      candidateId: profile.id,
      ...rankingResult,
    });
  } catch (error: any) {
    console.error('Job ranking error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

// GET - Get ranked jobs (same as POST but for convenience)
export async function GET(req: NextRequest) {
  return POST(req);
}

