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
    const { orderId, payerEmail, amount, currency, raw, couponCode } = body;

    // Validate required fields
    if (!orderId || !amount || !currency || !raw) {
      console.error('[PayPal Success] Missing required fields:', { orderId, amount, currency, hasRaw: !!raw });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get candidate profile to get candidate_id and check trial status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, trial_ends_at')
      .eq('email', session.user.email)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('[PayPal Success] Profile not found:', profileError);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user was on trial at payment time
    const wasOnTrial = profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date();

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
      wasOnTrial,
      couponCode: couponCode || null,
    });

    // Validate and apply discount code if provided
    let discountCodeData = null;
    if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
      const { data: discountCode, error: discountError } = await supabase
        .from('discount_codes')
        .select('code, discount_percent, duration_months, used')
        .eq('code', couponCode.toUpperCase().trim())
        .maybeSingle();

      if (!discountError && discountCode && !discountCode.used) {
        discountCodeData = discountCode;

        // Mark code as used
        await supabase
          .from('discount_codes')
          .update({ used: true })
          .eq('code', discountCode.code);

        console.log('[PayPal Success] Discount code applied:', {
          code: discountCode.code,
          percent: discountCode.discount_percent,
          durationMonths: discountCode.duration_months,
        });
      } else {
        console.warn('[PayPal Success] Invalid or already used discount code:', couponCode);
      }
    }

    // Calculate discount end date if discount code was applied
    let discountEndDate = null;
    if (discountCodeData) {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + discountCodeData.duration_months);
      discountEndDate = endDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    // Update profile payment status and discount info
    const updateData: any = {
      is_paid: true,
      paid_at: new Date().toISOString(),
      // DO NOT delete trial_ends_at - trial simply becomes irrelevant
    };

    if (discountCodeData) {
      updateData.discount_code = discountCodeData.code;
      updateData.discount_percent = discountCodeData.discount_percent;
      updateData.discount_end_date = discountEndDate;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', profile.id);

    if (updateError) {
      console.error('[PayPal Success] Failed to update profile payment status:', updateError);
      // Don't fail the request - payment is logged, profile update can be retried
    } else {
      console.log('[PayPal Success] Profile payment status updated:', {
        candidateId: profile.id,
        is_paid: true,
        wasOnTrial,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Log error server-side but return safe error message
    console.error('[PayPal Success] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

