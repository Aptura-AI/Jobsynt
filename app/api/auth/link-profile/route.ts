import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Link profile to authenticated user after password reset
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Link user_id to profile
    const { error } = await adminSupabase
      .from('profiles')
      .update({
        user_id: session.user.id,
        pending_auth: false,
      })
      .eq('email', session.user.email);

    if (error) {
      console.error('Error linking profile:', error);
      return NextResponse.json({ error: 'Failed to link profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Link profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

