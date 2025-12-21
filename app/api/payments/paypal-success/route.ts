/**
 * PayPal Payment Success API
 * 
 * POST /api/payments/paypal-success
 * 
 * Logs successful PayPal payments to payment_events table.
 * This is for auditability and future feature gating only.
 * No access changes, no entitlements granted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    // Require authenticated candidate
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[PayPal Success] Database not configured');
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get request body
    const body = await req.json().catch(() => ({}));
    const { orderId, payerEmail, amount, currency, raw } = body;

    // Validate required fields
    if (!orderId || !amount || !currency || !raw) {
      console.error('[PayPal Success] Missing required fields:', { orderId, amount, currency, hasRaw: !!raw });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get candidate profile to get candidate_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', session.user.email)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('[PayPal Success] Profile not found:', profileError);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Extract status from raw payload (fallback to 'completed' if not present)
    const status = raw?.status || 'completed';

    // Insert payment event with idempotency (ignore duplicates)
    const { data, error } = await supabase
      .from('payment_events')
      .insert({
        candidate_id: profile.id,
        provider: 'paypal',
        order_id: orderId,
        payer_email: payerEmail || null,
        amount: parseFloat(amount),
        currency: currency,
        status: status,
        raw_payload: raw,
      })
      .select()
      .single();

    // Handle duplicate order_id gracefully (idempotency)
    if (error) {
      if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
        // Duplicate order_id - this is fine, payment was already logged
        console.log('[PayPal Success] Payment already logged (duplicate order_id):', orderId);
        return NextResponse.json({ success: true, message: 'Payment already logged' });
      }

      // Other database errors
      console.error('[PayPal Success] Database error:', error);
      return NextResponse.json({ error: 'Failed to log payment' }, { status: 500 });
    }

    console.log('[PayPal Success] Payment logged successfully:', {
      orderId,
      candidateId: profile.id,
      amount,
      currency,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Log error server-side but return safe error message
    console.error('[PayPal Success] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

