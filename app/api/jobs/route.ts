// File: app/api/jobs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { SupabaseClient } from '@supabase/supabase-js';

// Centralized logic for fetching + upserting jobs
async function fetchAndStore(query: string) {
  // Uncomment and implement if Remotive support is restored
  /*
  const remotive = await safeFetchRemotive(query);
  */
  const arbeitnow = await safeFetchArbeitnow();
  const jsearch = await safeFetchJSearch(query);

  // Combine results (excluding Remotive)
  const combined = [
    // ...remotive,
    ...arbeitnow,
    ...jsearch,
  ];

  // Filter out entries without a valid URL
  const validJobs = combined.filter((job) => job.url && job.url.trim() !== '');

  if (validJobs.length === 0) {
    return NextResponse.json(
      { error: 'No valid jobs found from any source.' },
      { status: 404 }
    );
  }

  // Upsert into Supabase using `url` as the unique key
  const { error } = await supabase
    .from('jobs')
    .upsert(validJobs, { onConflict: 'url' });

  if (error) {
    console.error('Error upserting jobs:', error.message);
}

  return NextResponse.json(validJobs, { status: 200 });
}

// GET handler reads `?query=…`
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || 'developer';
  return fetchAndStore(query);
}

// POST handler reads `{ "query": "…" }` from JSON body
export async function POST(req: NextRequest) {
  let query = 'developer';
  try {
    const body = await req.json();
    if (typeof body.query === 'string' && body.query.trim()) {
      query = body.query.trim();
    }
  } catch {
    // Malformed JSON or missing body — fall back to default
  }
  return fetchAndStore(query);
}

// --------- Safe API Wrappers ----------

// Remotive support temporarily disabled due to SSL errors
/*
const safeFetchRemotive = async (query: string) => {
  try {
    const res = await fetch(`https://remotive.io/api/remote-jobs?search=${query}`);
    if (!res.ok) throw new Error(`Remotive status ${res.status}`);
    const data = await res.json();
    return (data.jobs || []).map((job: any) => ({
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location,
      url: job.url,
      source: 'Remotive',
    }));
  } catch (err) {
    console.error('Remotive fetch error:', err);
    return [];
  }
};
*/

const safeFetchArbeitnow = async () => {
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api');
    if (!res.ok) throw new Error(`Arbeitnow status ${res.status}`);
    const data = await res.json();
    return (data.data || []).map((job: any) => ({
      title: job.title,
      company: job.company_name,
      location: job.location,
      url: job.url,
      source: 'Arbeitnow',
    }));
  } catch (err) {
    console.error('Arbeitnow fetch error:', err);
    return [];
  }
};

const safeFetchJSearch = async (query: string) => {
  try {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) throw new Error('Missing RAPIDAPI_KEY');

    const res = await fetch(
      `https://jsearch.p.rapidapi.com/search?query=${query}`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
      }
    );

    if (!res.ok) throw new Error(`JSearch status ${res.status}`);
    const data = await res.json();
    return (data.data || []).map((job: any) => ({
      title: job.job_title,
      company: job.employer_name,
      location: job.job_city || job.job_country,
      url: job.job_apply_link,
      source: 'JSearch',
    }));
  } catch (err) {
    console.error('JSearch fetch error:', err);
    return [];
  }
};
