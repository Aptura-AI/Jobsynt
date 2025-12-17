/**
 * AI Job Ranking API
 * 
 * Uses OpenAI Responses API (prompt v3) to rank and curate matched jobs.
 * The AI acts as a recruiter agent, taking charge of job prioritization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';
import { rankJobsWithAI } from '@/lib/matching/rankJobsWithAI';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get candidate profile with all fields
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', session.user.email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
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

    // Rank jobs using AI
    const rankingResult = await rankJobsWithAI(profile.id, profile);

    return NextResponse.json({
      success: true,
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

