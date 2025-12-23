/**
 * Validate Coupon Code API
 * 
 * POST /api/payments/validate-coupon
 * 
 * Validates a discount code and returns discount information
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'Coupon code is required' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up discount code
    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .select('code, discount_percent, duration_months, used')
      .eq('code', code.toUpperCase().trim())
      .maybeSingle();

    if (error || !discountCode) {
      return NextResponse.json({ valid: false, error: 'Invalid coupon code' });
    }

    if (discountCode.used) {
      return NextResponse.json({ valid: false, error: 'This coupon code has already been used' });
    }

    return NextResponse.json({
      valid: true,
      discount_percent: discountCode.discount_percent,
      duration_months: discountCode.duration_months,
    });
  } catch (error: any) {
    console.error('[Validate Coupon] Error:', error);
    return NextResponse.json({ valid: false, error: 'Error validating coupon code' }, { status: 500 });
  }
}

