/**
 * Admin Candidates API - List All Candidates
 * 
 * GET /api/admin/candidates
 * - Lists ALL candidates (not just admin-created)
 * - Supports pagination, search, and filtering
 * - Admin-only access
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication
    const cookieStore = cookies();
    const rawToken = cookieStore.get('jobsynth_token')?.value;
    
    if (!rawToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = verifyToken(rawToken);
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const location = searchParams.get('location') || '';
    const platform = searchParams.get('platform') || '';
    const offset = (page - 1) * limit;

    // Build query - GET ALL CANDIDATES (not just admin-created)
    let query = supabase
      .from('profiles')
      .select('id, name, email, phone, location, experience_years, title, primary_skills, secondary_skills, primary_platform, resume_url, created_at, created_by_admin', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,title.ilike.%${search}%`);
    }

    if (location) {
      query = query.ilike('location', `%${location}%`);
    }

    if (platform) {
      query = query.eq('primary_platform', platform);
    }

    // Apply pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: candidates, error, count } = await query;

    if (error) {
      console.error('[Admin Candidates] Error fetching candidates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      candidates: candidates || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error: any) {
    console.error('[Admin Candidates] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

