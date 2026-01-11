import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin Email Metrics API
 * Returns email performance metrics
 */
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
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Emails sent by type
    const { data: emailsByType } = await supabase
      .from('email_events')
      .select('type, id, opened_at')
      .gte('sent_at', `${thirtyDaysAgo}T00:00:00Z`);

    const emailsByTypeCount: Record<string, number> = {};
    const opensByType: Record<string, number> = {};

    emailsByType?.forEach(email => {
      const type = email.type || 'unknown';
      emailsByTypeCount[type] = (emailsByTypeCount[type] || 0) + 1;
      if (email.opened_at) {
        opensByType[type] = (opensByType[type] || 0) + 1;
      }
    });

    // Total emails sent (last 30 days)
    const { count: totalEmailsSent } = await supabase
      .from('email_events')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', `${thirtyDaysAgo}T00:00:00Z`);

    // Total emails opened (last 30 days)
    const { count: totalEmailsOpened } = await supabase
      .from('email_events')
      .select('*', { count: 'exact', head: true })
      .not('opened_at', 'is', null)
      .gte('sent_at', `${thirtyDaysAgo}T00:00:00Z`);

    // Emails sent today
    const { count: emailsSentToday } = await supabase
      .from('email_events')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', `${today}T00:00:00Z`);

    // Emails opened today
    const { count: emailsOpenedToday } = await supabase
      .from('email_events')
      .select('*', { count: 'exact', head: true })
      .not('opened_at', 'is', null)
      .gte('opened_at', `${today}T00:00:00Z`);

    // Open rate (last 30 days)
    const totalEmailsSentCount = totalEmailsSent || 0;
    const totalEmailsOpenedCount = totalEmailsOpened || 0;
    const openRate = totalEmailsSentCount > 0
      ? Math.round((totalEmailsOpenedCount / totalEmailsSentCount) * 100)
      : 0;

    // Open rate trend (last 7 days vs previous 7 days)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const { data: recentEmails } = await supabase
      .from('email_events')
      .select('sent_at, opened_at')
      .gte('sent_at', `${fourteenDaysAgo}T00:00:00Z`);

    const recent7Days = recentEmails?.filter(e => 
      new Date(e.sent_at) >= new Date(sevenDaysAgo)
    ) || [];
    const previous7Days = recentEmails?.filter(e => 
      new Date(e.sent_at) >= new Date(fourteenDaysAgo) && 
      new Date(e.sent_at) < new Date(sevenDaysAgo)
    ) || [];

    const recent7DaysOpened = recent7Days.filter(e => e.opened_at).length;
    const previous7DaysOpened = previous7Days.filter(e => e.opened_at).length;
    const recent7DaysRate = recent7Days.length > 0 ? (recent7DaysOpened / recent7Days.length) * 100 : 0;
    const previous7DaysRate = previous7Days.length > 0 ? (previous7DaysOpened / previous7Days.length) * 100 : 0;
    const openRateChange = Math.round(recent7DaysRate - previous7DaysRate);

    return NextResponse.json({
      totalEmailsSent: totalEmailsSentCount,
      totalEmailsOpened: totalEmailsOpenedCount,
      emailsSentToday: emailsSentToday || 0,
      emailsOpenedToday: emailsOpenedToday || 0,
      openRate,
      openRateChange,
      emailsByType: emailsByTypeCount,
      opensByType,
      recent7DaysRate: Math.round(recent7DaysRate),
      previous7DaysRate: Math.round(previous7DaysRate),
    });
  } catch (error: any) {
    console.error('Admin email metrics error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

