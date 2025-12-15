import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { title, location, work_mode, contract_type, pay_rate, description, job_link } = await req.json();

    if (!title || !location || !description) {
      return NextResponse.json({ error: 'Title, location, and description are required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // TODO: Get company_id from session
    const jobData = {
      title: String(title).trim(),
      company: 'Company Name', // TODO: Get from company session
      location: String(location).trim(),
      url: job_link ? String(job_link).trim() : null,
      description: String(description).trim(),
      salary: pay_rate ? String(pay_rate).trim() : null,
      posted_date: new Date().toISOString().split('T')[0],
      source: 'company',
      is_active: true,
      company_id: null, // TODO: Set from session
    };

    const { data, error } = await supabase
      .from('scraped_jobs')
      .insert(jobData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Job posted successfully',
      job: data
    }, { status: 201 });
  } catch (error: any) {
    console.error('Post job error:', error);
    return NextResponse.json({ error: error.message || 'Failed to post job' }, { status: 500 });
  }
}

