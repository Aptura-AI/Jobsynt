// app/api/profiles/route.ts
import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const profileData = await request.json();
    
    // Correct way to use Supabase client
    const { data, error } = await supabase
      .from('profiles') // This is the correct usage
      .upsert(profileData);
    
    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Correct way to query data
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    
    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch profiles' },
      { status: 500 }
    );
  }
}