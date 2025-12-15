import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';

    // Trigger matching for each profile (async, don't await)
    let triggered = 0;
    for (const profile of profiles || []) {
      try {
        await fetch(`${baseUrl}/api/ai-match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile_id: profile.id }),
        });
        triggered++;
      } catch (err) {
        console.error('Error triggering match for profile:', profile.id, err);
      }
    }

    return NextResponse.json({
      message: `Triggered AI matching for ${triggered} profiles`,
      profiles: triggered,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Cron AI match error:', error);
    return NextResponse.json({ error: error.message || 'Cron failed' }, { status: 500 });
  }
}

