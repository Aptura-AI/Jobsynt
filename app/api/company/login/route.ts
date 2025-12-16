import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyPassword, signToken, setAuthCookie } from '@/utils/auth';
import type { UserRole } from '@/lib/auth-routing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error || !company) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(password, company.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Company login - role must be 'company'
    const role: UserRole = 'company';
    const token = signToken({
      email: company.email,
      role,
      company_id: company.id,
    });
    setAuthCookie(token);

    return NextResponse.json({
      email: company.email,
      name: company.name,
      company_id: company.id,
      role: 'company',
    });
  } catch (error: any) {
    console.error('Company login error:', error);
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 });
  }
}

