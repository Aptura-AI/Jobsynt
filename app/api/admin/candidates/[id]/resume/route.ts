/**
 * Admin Candidates API - Download Resume
 * 
 * GET /api/admin/candidates/[id]/resume
 * - Downloads candidate resume from Supabase storage
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

    // Get candidate profile to find resume URL
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('resume_url, name')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    if (!profile.resume_url) {
      return NextResponse.json({ error: 'Resume not available' }, { status: 404 });
    }

    // Extract file path from resume_url
    // Supabase storage URLs are typically: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
    const resumeUrl = profile.resume_url;

    // If it's a full URL, redirect to it
    if (resumeUrl.startsWith('http')) {
      // Fetch the file and stream it
      try {
        const response = await fetch(resumeUrl);
        if (!response.ok) {
          return NextResponse.json({ error: 'Resume file not found' }, { status: 404 });
        }

        const blob = await response.blob();
        const fileName = profile.name 
          ? `${profile.name.replace(/\s+/g, '_')}_Resume.pdf`
          : `Candidate_${id}_Resume.pdf`;

        return new NextResponse(blob, {
          headers: {
            'Content-Type': blob.type || 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
          },
        });
      } catch (fetchError: any) {
        console.error('[Admin Candidates] Error fetching resume:', fetchError);
        return NextResponse.json({ error: 'Failed to fetch resume' }, { status: 500 });
      }
    }

    // If it's a storage path, use Supabase storage client
    const { data: fileData, error: storageError } = await supabase.storage
      .from('resumes')
      .download(resumeUrl);

    if (storageError || !fileData) {
      console.error('[Admin Candidates] Storage error:', storageError);
      return NextResponse.json({ error: 'Resume file not found' }, { status: 404 });
    }

    const fileName = profile.name 
      ? `${profile.name.replace(/\s+/g, '_')}_Resume.pdf`
      : `Candidate_${id}_Resume.pdf`;

    return new NextResponse(fileData, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('[Admin Candidates] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

