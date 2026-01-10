import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hashPassword } from '@/utils/auth.server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { name, contact_name, designation, email, phone, password } = await req.json();

    if (!name || !contact_name || !email || !password) {
      return NextResponse.json({ error: 'Name, contact name, email, and password are required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const passwordHash = await hashPassword(password);

    const { data, error } = await supabase
      .from('companies')
      .insert({
        name,
        contact_name,
        designation: designation || null,
        email: email.toLowerCase(),
        phone: phone || null,
        password_hash: passwordHash,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Company with this email already exists' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Company registered successfully',
      company: { id: data.id, name: data.name, email: data.email }
    }, { status: 201 });
  } catch (error: any) {
    console.error('Company signup error:', error);
    return NextResponse.json({ error: error.message || 'Registration failed' }, { status: 500 });
  }
}

